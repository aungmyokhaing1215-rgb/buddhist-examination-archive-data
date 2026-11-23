import {isAdmin} from '../../_lib/auth.js'
import {readJson,writeJson,treeFiles} from '../../_lib/github.js'
import {readSource} from '../../_lib/data.js'
import {send,method,fail} from '../../_lib/http.js'
export default async function handler(req,res){if(!method(req,res,['GET']))return;if(!await isAdmin(req))return send(res,401,{error:'Authentication required'});try{const[classes,subjects,index,paths,draftPaths]=await Promise.all([readSource('classes'),readSource('subjects'),readSource('index'),treeFiles(),treeFiles('drafts','')]);const exams={},drafts={};for(const path of paths){const file=await readJson(path);if(file.data)exams[path]=file.data}for(const path of draftPaths){const file=await readJson(path,'');if(file.data)drafts[path]=file.data}send(res,200,{schemaVersion:2,classes:classes.data,subjects:subjects.data,index:index.data,exams,drafts})}catch(e){fail(res,e)}}
