"""Scientific-contract checks; run with python -m unittest discover here."""
import json,pathlib,unittest
import numpy as np
from scipy.spatial.distance import pdist
from compare import effective_weight,graph_for,invariants,segment_metrics,ROOT,HERE

class AnalysisTests(unittest.TestCase):
    def test_weights_and_paths(self):
        for value in (None,0,0.0): self.assertEqual(effective_weight(value),1)
        for value in (-1,True,False,'1',float('nan'),float('inf')):
            with self.assertRaises(ValueError): effective_weight(value)
        data={'nodes':[{'id':v} for v in 'abc'],'edges':[{'source':'a','target':'b'},{'source':'b','target':'c'}]}
        g=graph_for(data,[4,1])
        import networkx as nx
        self.assertEqual(nx.shortest_path_length(g,'a','c',weight='length'),1.5)

    def test_geometry_invariance_and_stress(self):
        x=np.random.default_rng(4).normal(size=(12,3));q,_=np.linalg.qr(np.random.default_rng(5).normal(size=(3,3)))
        y=8*x@q+np.array([100,-2,8])
        self.assertLess(max(invariants(x,y).values()),1e-14)
        r=pdist(y);d=pdist(x);s=r@d/(r@r)
        self.assertLess(np.linalg.norm(s*r-d)/np.linalg.norm(d),1e-13)

    def test_crossing_is_not_3d_intersection(self):
        x=np.array([[-1,0,0],[1,0,0],[0,-1,1],[0,1,1]],float)
        a=segment_metrics(x,[(0,1),(2,3)],[(0,1)],1)
        self.assertEqual(a['crossings_xy'],1);self.assertEqual(a['edge_near_approaches_3d'],0)
        x[2:,2]=0
        self.assertEqual(segment_metrics(x,[(0,1),(2,3)],[(0,1)],1)['edge_near_approaches_3d'],1)

    def test_saved_experiment_contract(self):
        result=HERE/'results';rows=json.loads((result/'results.json').read_text());meta=json.loads((result/'metadata.json').read_text());coords=json.loads((result/'coordinates.json').read_text());ref=json.loads((HERE/'expert-reference.json').read_text())
        self.assertEqual(len(rows),100);self.assertTrue(meta['canonical_section_matches']);self.assertEqual(len(ref['triplets']),18)
        lookup={(v['algorithm'],v['seed'],v['scenario']):v for v in coords}
        for seed in ref['protocol']['seeds']:
            self.assertEqual(lookup[('B0_d3_unweighted',seed,'base')]['positions'],lookup[('Bw_d3_weighted',seed,'base')]['positions'])
        for row in rows:
            self.assertTrue(all(np.isfinite(v) for k,v in row.items() if isinstance(v,(int,float))))
            self.assertGreaterEqual(row['stress'],0);self.assertLessEqual(row['stress'],1)
        for run in coords:
            self.assertEqual(len(run['positions']),48)

if __name__=='__main__':unittest.main()
