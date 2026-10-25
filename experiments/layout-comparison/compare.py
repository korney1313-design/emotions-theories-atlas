#!/usr/bin/env python3
"""Reproducible offline experiment for issue #2. No private source dependency."""
import argparse,csv,hashlib,itertools,json,math,pathlib,platform,subprocess,sys,time
import numpy as np
import scipy
from scipy.spatial.distance import pdist,squareform
from scipy.linalg import orthogonal_procrustes
import networkx as nx
from sklearn.metrics import adjusted_rand_score,normalized_mutual_info_score,silhouette_score
import sklearn
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
ALGORITHMS=['A_section','B0_d3_unweighted','Bw_d3_weighted','C_kamada_kawai']

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def dump(path,data): path.write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
def effective_weight(value):
    if isinstance(value,bool): raise ValueError('Boolean is not a weight')
    if value is None or value==0: return 1.0
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<0: raise ValueError('Invalid relationship weight')
    return float(value)
def graph_for(data,weights):
    g=nx.Graph();g.add_nodes_from(n['id'] for n in data['nodes'])
    for e,w in zip(data['edges'],weights):
        if g.has_edge(e['source'],e['target']): raise ValueError('Parallel undirected edges need explicit aggregation')
        g.add_edge(e['source'],e['target'],strength=w,length=1/math.sqrt(w))
    if not nx.is_connected(g): raise ValueError('Disconnected graph: protocol needs separate-component policy')
    return g

def invariants(x,y):
    # Translation, uniform scale, rotation/reflection removed; handedness has no semantic meaning.
    x=x-x.mean(0);y=y-y.mean(0);x=x/np.linalg.norm(x);y=y/np.linalg.norm(y)
    rotation,_=orthogonal_procrustes(x,y)
    return {'procrustes_rms':float(np.linalg.norm(x@rotation-y)),
            'distance_matrix_relative_rms':float(np.linalg.norm(pdist(x)-pdist(y))/np.linalg.norm(pdist(y)))}

def segment_metrics(x,edges,pairs,median):
    # Strict crossings in three orthographic views, plus true 3D near-approaches.
    e=np.asarray(edges);p=np.asarray(pairs)
    a=x[e[p[:,0],0]]; b=x[e[p[:,0],1]];c=x[e[p[:,1],0]];d=x[e[p[:,1],1]]
    def cross(u,v): return u[:,0]*v[:,1]-u[:,1]*v[:,0]
    counts=[]
    for axes in ([0,1],[0,2],[1,2]):
        aa,bb,cc,dd=(v[:,axes] for v in (a,b,c,d))
        counts.append(int(np.sum((cross(bb-aa,cc-aa)*cross(bb-aa,dd-aa)<-1e-12)&(cross(dd-cc,aa-cc)*cross(dd-cc,bb-cc)<-1e-12))))
    def point_segment(q,u,v):
        delta=v-u;t=np.sum((q-u)*delta,axis=1)/np.maximum(np.sum(delta*delta,axis=1),1e-30)
        return np.linalg.norm(q-(u+np.clip(t,0,1)[:,None]*delta),axis=1)
    distances=np.minimum.reduce([point_segment(a,c,d),point_segment(b,c,d),point_segment(c,a,b),point_segment(d,a,b)])
    u=b-a;v=d-c;w=a-c
    aa=np.sum(u*u,axis=1);bb=np.sum(u*v,axis=1);cc=np.sum(v*v,axis=1);dd=np.sum(u*w,axis=1);ee=np.sum(v*w,axis=1)
    denom=aa*cc-bb*bb;valid=denom>1e-20
    s=np.divide(bb*ee-cc*dd,denom,out=np.zeros_like(denom),where=valid)
    t=np.divide(aa*ee-bb*dd,denom,out=np.zeros_like(denom),where=valid)
    interior=valid&(s>=0)&(s<=1)&(t>=0)&(t<=1)
    distances[interior]=np.minimum(distances[interior],np.linalg.norm(w+s[:,None]*u-t[:,None]*v,axis=1)[interior])
    return {'crossings_xy':counts[0],'crossings_xz':counts[1],'crossings_yz':counts[2],
            'crossings_projection_mean':float(np.mean(counts)),
            'edge_near_approaches_3d':int(np.sum(distances<.02*median))}

def measure(x,D,g,ids,ref,sections):
    r=pdist(x);target=squareform(D,checks=False);scale=float(r@target/(r@r));dist=squareform(r);median=float(np.median(r));index={v:i for i,v in enumerate(ids)}
    scores=[]
    for t in ref['triplets']:
        a,b,c=(index[t[key]] for key in ('anchor','near','far'))
        gap=float((dist[a,c]-dist[a,b])/median)
        scores.append({'id':t['id'],'gap_median':gap,'pass':bool(gap>ref['protocol']['triplet_margin_median'])})
    k=ref['protocol']['knn']; recalls=[];edge_recalls=[];intrusions=[]
    for i,v in enumerate(ids):
        order=np.argsort(np.where(np.arange(len(ids))==i,np.inf,dist[i]),kind='stable')
        near=order[:k];threshold=np.sort(np.delete(D[i],i))[k-1]
        allowed=set(np.flatnonzero((D[i]<=threshold+1e-12)&(np.arange(len(ids))!=i)))
        recalls.append(len(set(near)&allowed)/k)
        neighbors={index[w] for w in g.neighbors(v)};edge_recalls.append(len(set(order[:len(neighbors)])&neighbors)/len(neighbors))
        intrusions.extend((i,int(j)) for j in near if D[i,j]>threshold+1e-12)
    edges=[(index[a],index[b]) for a,b in g.edges()]
    pairs=[(i,j) for i,j in itertools.combinations(range(len(edges)),2) if not set(edges[i])&set(edges[j])]
    metrics={'stress':float(np.linalg.norm(scale*r-target)/np.linalg.norm(target)),
      'expert_triplet_accuracy':sum(t['pass'] for t in scores)/len(scores),
      'target_neighborhood_recall5_tie_permissive':float(np.mean(recalls)),
      'edge_neighbor_recall':float(np.mean(edge_recalls)),
      'section_silhouette_exploratory':float(silhouette_score(x,sections)),
      'scale_to_target':scale,'third_axis_variance_fraction':float(np.linalg.svd(x-x.mean(0),compute_uv=False)[-1]**2/np.sum((x-x.mean(0))**2)),
      **segment_metrics(x,edges,pairs,median)}
    # All 1128 pairs saved: no cherry-picked nearest-neighbor examples.
    pairrows=[{'a':ids[i],'b':ids[j],'target':float(D[i,j]),'actual_scaled':float(dist[i,j]*scale),'residual':float(dist[i,j]*scale-D[i,j]),'distance_median':float(dist[i,j]/median)} for i,j in itertools.combinations(range(len(ids)),2)]
    return metrics,scores,pairrows

def execute(out):
    out.mkdir(parents=True,exist_ok=True)
    data=json.loads((ROOT/'public/atlases/emotions.json').read_text());ref=json.loads((HERE/'expert-reference.json').read_text())
    assert sha(ROOT/'public/atlases/emotions.json')==ref['input_sha256']
    assert (len(data['nodes']),len(data['edges']))==(48,77)
    ids=[n['id'] for n in data['nodes']];seeds=ref['protocol']['seeds'];weights=[effective_weight(e.get('weight')) for e in data['edges']]
    scenarios=[]
    for cfg in ref['protocol']['perturbations']:
        rng=np.random.default_rng(cfg['seed']);w=np.array(weights)*(1+rng.uniform(-cfg['amplitude'],cfg['amplitude'],len(weights)))
        scenarios.append({**cfg,'weights':w.tolist()})
    request={'data':data,'seeds':seeds,'ticks':ref['protocol']['ticks'],'scenarios':scenarios}
    start=time.perf_counter()
    adapter=json.loads(subprocess.check_output(['node',str(HERE/'d3-layouts.mjs')],input=json.dumps(request).encode(),cwd=ROOT))
    runs=adapter['runs'];targets={};graphs={}
    for scenario in scenarios:
        g=graph_for(data,scenario['weights']);graphs[scenario['id']]=g
        shortest=dict(nx.all_pairs_dijkstra_path_length(g,weight='length'))
        D=np.array([[shortest[a][b] for b in ids] for a in ids]);targets[scenario['id']]=D
        for seed in seeds:
            rng=np.random.default_rng(seed);initial={v:rng.uniform(-1,1,3) for v in ids}
            pos=nx.kamada_kawai_layout(g,dist=shortest,pos=initial,dim=3)
            runs.append({'algorithm':'C_kamada_kawai','seed':seed,'scenario':scenario['id'],'positions':{v:pos[v].tolist() for v in ids}})
    rows=[];triplets=[];pair_results={};arrays={}
    for run in runs:
        p=run['positions'];x=np.array([[p[v][a] for a in ('x','y','z')] if isinstance(p[v],dict) else p[v] for v in ids]);arrays[(run['algorithm'],run['seed'],run['scenario'])]=x
        metrics,scores,pairs=measure(x,targets[run['scenario']],graphs[run['scenario']],ids,ref,[n['section'] for n in data['nodes']])
        key={k:run[k] for k in ('algorithm','seed','scenario')};rows.append({**key,**metrics})
        triplets.extend({**key,**score} for score in scores)
        if run['seed']==92481 and run['scenario']=='base': pair_results[run['algorithm']]=pairs
    stability=[]
    for a in ALGORITHMS:
        for seed in seeds:
            x=arrays[(a,seed,'base')]
            if seed!=92481: stability.append({'algorithm':a,'kind':'seed','seed':seed,'scenario':'base',**invariants(x,arrays[(a,92481,'base')])})
            for s in scenarios[1:]: stability.append({'algorithm':a,'kind':'weight','seed':seed,'scenario':s['id'],**invariants(arrays[(a,seed,s['id'])],x)})
    sections=[n['section'] for n in data['nodes']];community=[]
    for scenario in scenarios:
        g=graphs[scenario['id']]
        for seed in seeds:
            groups=nx.community.louvain_communities(g,weight='strength',seed=seed,resolution=1)
            membership={v:i for i,c in enumerate(groups) for v in c};labels=[membership[v] for v in ids]
            community.append({'scenario':scenario['id'],'seed':seed,'communities':len(groups),'ARI':adjusted_rand_score(sections,labels),'NMI':normalized_mutual_info_score(sections,labels),'membership':membership})
    prod=[adapter['production_communities'][v] for v in ids]
    metadata={'input_sha256':sha(ROOT/'public/atlases/emotions.json'),'expert_sha256':sha(HERE/'expert-reference.json'),
      'model_sha256':sha(ROOT/'src/model.js'),'adapter_sha256':sha(HERE/'d3-layouts.mjs'),'analysis_sha256':sha(HERE/'compare.py'),
      'versions':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'networkx':nx.__version__,'scikit-learn':sklearn.__version__,'matplotlib':matplotlib.__version__,'node':subprocess.check_output(['node','--version'],text=True).strip(),'npm_packages':json.loads(subprocess.check_output(['npm','ls','--json','--depth=0'],cwd=ROOT,text=True))['dependencies']},
      'config':request|{'data':'public/atlases/emotions.json (unchanged)'},'canonical_section_matches':adapter['canonical_section_matches'],
      'production_community_ARI':adjusted_rand_score(sections,prod),'production_community_NMI':normalized_mutual_info_score(sections,prod),
      'node_count':len(ids),'edge_count':len(data['edges']),'disjoint_edge_pairs':sum(not {a['source'],a['target']}&{b['source'],b['target']} for a,b in itertools.combinations(data['edges'],2)),
      'elapsed_seconds':time.perf_counter()-start}
    dump(out/'metadata.json',metadata);dump(out/'coordinates.json',runs);dump(out/'results.json',rows);dump(out/'triplets.json',triplets);dump(out/'pair-diagnostics.json',pair_results);dump(out/'stability.json',stability);dump(out/'communities.json',community)
    with (out/'results.csv').open('w') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    # Diagnostic projections only, never a substitute for the application.
    fig,axes=plt.subplots(2,2,figsize=(14,11));colors=plt.get_cmap('tab10');groups=list(dict.fromkeys(sections))
    for ax,a in zip(axes.flat,ALGORITHMS):
        x=arrays[(a,92481,'base')];x=(x-x.mean(0))/np.median(pdist(x))
        for e in data['edges']:
            i,j=ids.index(e['source']),ids.index(e['target']);ax.plot(x[[i,j],0],x[[i,j],1],color='#666666',alpha=.3,lw=.6,zorder=1)
        for i,n in enumerate(data['nodes']):
            ax.scatter(x[i,0],x[i,1],color=colors(groups.index(n['section'])),s=28,zorder=2)
        # Only selected diagnostic anchors labeled; avoids 48 overlapping labels.
        for v in ('construction','appraisal','regulation','experience','basic','grief'):
            i=ids.index(v);ax.annotate(v,x[i,:2],fontsize=7,xytext=(3,3),textcoords='offset points')
        ax.set_title(a);ax.set_aspect('equal');ax.set_xlabel('x / median distance');ax.set_ylabel('y / median distance');ax.grid(alpha=.15)
    from matplotlib.lines import Line2D
    fig.legend(handles=[Line2D([0],[0],marker='o',color='w',label=g,markerfacecolor=colors(i),markersize=6) for i,g in enumerate(groups)],loc='lower center',ncol=4,fontsize=8)
    fig.suptitle('Offline diagnostic XY projections | seed 92481 | same semantic graph\nColors: author sections. Projection crossings are view-dependent.');fig.tight_layout(rect=(0,.07,1,.97));fig.savefig(out/'diagnostic-projections.png',dpi=140);plt.close(fig)
    summary={}
    for a in ALGORITHMS:
        base=[r for r in rows if r['algorithm']==a and r['scenario']=='base']
        summary[a]={k:{'mean':float(np.mean([r[k] for r in base])),'min':float(min(r[k] for r in base)),'max':float(max(r[k] for r in base))} for k in ('stress','expert_triplet_accuracy','edge_neighbor_recall','target_neighborhood_recall5_tie_permissive','crossings_projection_mean','edge_near_approaches_3d','section_silhouette_exploratory')}
    dump(out/'summary.json',summary);print(json.dumps(summary,indent=2));print('Wrote',len(runs),'runs to',out)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=pathlib.Path,default=HERE/'results');args=parser.parse_args();execute(args.out)
