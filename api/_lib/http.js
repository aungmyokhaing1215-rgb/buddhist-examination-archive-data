export function send(res, status, data) { res.status(status).setHeader('Content-Type','application/json; charset=utf-8').end(JSON.stringify(data)) }
export function method(req,res,allowed) { if(!allowed.includes(req.method)){res.setHeader('Allow',allowed.join(', '));send(res,405,{error:'Method not allowed'});return false}return true }
export function body(req){return typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{}}
export function fail(res,error){console.error(error);send(res,500,{error:'Request could not be completed'})}
