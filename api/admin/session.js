import {isAdmin} from '../_lib/auth.js'
import {send,method} from '../_lib/http.js'
export default async function handler(req,res){if(!method(req,res,['GET']))return;const ok=await isAdmin(req);send(res,ok?200:401,{authenticated:ok})}
