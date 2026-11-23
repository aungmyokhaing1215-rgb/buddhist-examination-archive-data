import {getCatalog} from '../../_lib/data.js'
import {send,method,fail} from '../../_lib/http.js'
export default async function handler(req,res){if(!method(req,res,['GET']))return;try{res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');send(res,200,await getCatalog())}catch(e){fail(res,e)}}
