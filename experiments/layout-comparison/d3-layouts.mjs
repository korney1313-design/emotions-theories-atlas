// Offline adapter: imports production model; never mutates atlas data or UI.
import fs from 'node:fs';
import {createModel,seededRandom,coordinates} from '../../src/model.js';
import {forceSimulation,forceLink,forceManyBody,forceCollide,forceX,forceY,forceZ} from 'd3-force-3d';
const input = JSON.parse(fs.readFileSync(0,'utf8'));
const model = createModel(input.data);
const groups = [...new Set(model.nodes.map(n=>n.section))];
const centers = Object.fromEntries(groups.map((g,i)=>{
 const angle=i/groups.length*Math.PI*2+Math.PI/8;
 return [g,{x:Math.cos(angle)*285,y:Math.sin(angle)*235,z:Math.sin(angle*2+.6)*105}];
}));
function section(seed){
 const random=seededRandom(seed);
 const nodes=model.nodes.map(n=>({...n,...Object.fromEntries(['x','y','z'].map(a=>[a,centers[n.section][a]+(random()-.5)*140]))}));
 const sim=forceSimulation(nodes,3).stop().randomSource(seededRandom(seed))
 .force('link',forceLink(input.data.edges.map(e=>({...e}))).id(n=>n.id).distance(e=>e.source.section===e.target.section?75:330).strength(e=>e.source.section===e.target.section?.12:.007))
 .force('charge',forceManyBody().strength(-95)).force('collision',forceCollide(n=>n.radius+22).iterations(3))
 .force('x',forceX(n=>centers[n.section].x).strength(.24)).force('y',forceY(n=>centers[n.section].y).strength(.24)).force('z',forceZ(n=>centers[n.section].z).strength(.24));
 sim.tick(input.ticks); sim.stop();return coordinates(nodes);
}
function free(seed,weights){
 const random=seededRandom(seed);
 const nodes=model.nodes.map(n=>({...n,x:(random()-.5)*400,y:(random()-.5)*400,z:(random()-.5)*400}));
 const links=input.data.edges.map((e,i)=>({...e,w:weights[i]}));
 const sim=forceSimulation(nodes,3).stop().randomSource(seededRandom(seed))
 .force('link',forceLink(links).id(n=>n.id).distance(e=>100/Math.sqrt(e.w)).strength(e=>.1*e.w))
 .force('charge',forceManyBody().strength(-95)).force('collision',forceCollide(n=>n.radius+22).iterations(3))
 .force('x',forceX(0).strength(.005)).force('y',forceY(0).strength(.005)).force('z',forceZ(0).strength(.005));
 sim.tick(input.ticks);sim.stop();return coordinates(nodes);
}
const runs=[];
for(const seed of input.seeds){
 const a=section(seed),b=free(seed,input.data.edges.map(()=>1));
 for(const scenario of input.scenarios){
 runs.push({algorithm:'A_section',seed,scenario:scenario.id,positions:a});
 runs.push({algorithm:'B0_d3_unweighted',seed,scenario:scenario.id,positions:b});
 runs.push({algorithm:'Bw_d3_weighted',seed,scenario:scenario.id,positions:free(seed,scenario.weights)});
 }
}
const baseline=section(92481);
if(JSON.stringify(baseline)!==JSON.stringify(model.layouts.section)) throw Error('Section adapter differs from production');
process.stdout.write(JSON.stringify({runs,canonical_section_matches:true,production_communities:Object.fromEntries(model.nodes.map(n=>[n.id,n.community]))}));
