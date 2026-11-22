import {login} from '../_lib/auth.js'
import {send,method,body,fail} from '../_lib/http.js'
export default async function handler(req,res){if(!method(req,res,['POST']))return;try{const ok=await login(req,res,body(req).password);if(!ok)return send(res,401,{error:'Invalid password'});send(res,200,{ok:true})}catch(e){fail(res,e)}}
