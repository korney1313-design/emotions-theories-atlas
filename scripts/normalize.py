from pathlib import Path
import csv,json,xml.etree.ElementTree as E
p=Path(__file__).resolve().parents[1]; base=p/'originals/2026-10-24'
nodes=[];edges=[]
for row,r in enumerate(csv.DictReader((base/'berne_nodes.csv').open(encoding='utf-8-sig')),2):
 nodes.append(dict(id=r['Id'],label=r['Label'],section=r['Group'],definition=r['Description'],provenance={'file':'berne_nodes.csv','row':row}))
for row,r in enumerate(csv.DictReader((base/'berne_edges.csv').open(encoding='utf-8-sig')),2):
 edges.append(dict(id=f'e{row-2}',source=r['Source'],target=r['Target'],relation=r['Relation'].replace('_',' '),rawRelation=r['Relation'],weight=float(r['Weight']),status=r['Status'],provenance={'file':'berne_edges.csv','row':row,'direction':'Source → Target; интерпретация порядка CSV, GEXF — undirected'}))
ns={'g':'http://www.gexf.net/1.2draft'};root=E.parse(base/'berne_atlas_experiment.gexf')
gnodes={n.attrib['id']:n.attrib['label'] for n in root.findall('.//g:node',ns)}
gedges=[(e.attrib['source'],e.attrib['target'],e.attrib['label']) for e in root.findall('.//g:edge',ns)]
comparison={'node_labels_match':gnodes=={n['id']:n['label'] for n in nodes},'edge_triples_match':gedges==[(e['source'],e['target'],e['rawRelation']) for e in edges],'direction_difference':'GEXF undirected; рабочая модель направлена по Source → Target CSV'}
(p/'public/atlas.json').write_text(json.dumps(dict(title='Транзактный анализ Эрика Берна',nodes=nodes,edges=edges,provenance={'kind':'Найденная экспериментальная сеть','bibliography':'Библиографические ссылки и страницы в исходниках не указаны. Определения и отношения перенесены из экспериментальных CSV без научной верификации.','comparison':comparison}),ensure_ascii=False,indent=2))
print(comparison)
