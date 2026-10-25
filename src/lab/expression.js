// Bounded JSON expression language. No eval, functions, IO or implicit coercion.
export const OPERATORS = { eq: 2, ne: 2, and: -1, or: -1, not: 1, if: 3, known: -1, add: 2, concat: -1, compact: 1, includes: 2 };
export const safeKey = (key) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(key) && !['constructor','prototype','__proto__'].includes(key);
export const copy = (value) => structuredClone(value);
export function readPath(env, path) {
  let current = env;
  for (const key of path.split('.')) {
    if (!safeKey(key) || current === null || typeof current !== 'object' || !Object.hasOwn(current,key)) throw Error(`Unknown reference: ${path}`);
    current = current[key];
  }
  return current;
}
export function evaluate(expr, env) {
  if (expr === null || typeof expr !== 'object') return expr;
  if (Array.isArray(expr)) return expr.map(v=>evaluate(v,env));
  if (Object.hasOwn(expr,'ref')) return copy(readPath(env,expr.ref));
  if (Object.hasOwn(expr,'record')) return Object.fromEntries(Object.entries(expr.record).map(([k,v])=>[k,evaluate(v,env)]));
  const {op,args} = expr;
  if (op === 'if') {
    const condition=evaluate(args[0],env);
    if (typeof condition!=='boolean') throw Error('if requires a boolean condition');
    return evaluate(args[condition?1:2],env);
  }
  const a=args.map(v=>evaluate(v,env));
  switch(op) {
    case 'eq': return JSON.stringify(a[0])===JSON.stringify(a[1]);
    case 'ne': return JSON.stringify(a[0])!==JSON.stringify(a[1]);
    case 'known': return a.every(v=>v!==null);
    case 'and': case 'or':
      if(a.some(v=>typeof v!=='boolean')) throw Error(`${op} requires booleans`);
      return op==='and'?a.every(Boolean):a.some(Boolean);
    case 'not': if(typeof a[0]!=='boolean') throw Error('not requires boolean'); return !a[0];
    case 'add': if(a.some(v=>typeof v!=='number'||!Number.isFinite(v))) throw Error('add requires finite numbers'); return a[0]+a[1];
    case 'concat': if(a.some(v=>!Array.isArray(v))) throw Error('concat requires arrays'); return a.flat();
    case 'compact': if(!Array.isArray(a[0])) throw Error('compact requires array'); return a[0].filter(v=>v!==null);
    case 'includes': if(!Array.isArray(a[0])) throw Error('includes requires array'); return a[0].includes(a[1]);
    default: throw Error(`Unsupported operator: ${op}`);
  }
}
