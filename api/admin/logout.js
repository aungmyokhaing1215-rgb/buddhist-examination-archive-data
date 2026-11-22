import {clearSession} from '../_lib/auth.js'
export default function handler(req,res){clearSession(res);res.writeHead(302,{Location:'/admin'});res.end()}
