import { SignJWT,jwtVerify } from 'jose'
import { parse,serialize } from 'cookie'
const cookieName='archive_session'
function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw Error('SESSION_SECRET must contain at least 32 characters');return new TextEncoder().encode(value)}
export async function issueSession(){return new SignJWT({role:'admin'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').sign(secret())}
export async function isAdmin(req){try{const token=parse(req.headers.cookie||'')[cookieName];if(!token)return false;const {payload}=await jwtVerify(token,secret());return payload.role==='admin'}catch{return false}}
export async function login(req,res,password){if(!password||password!==process.env.ADMIN_PASSWORD)return false;const token=await issueSession();res.setHeader('Set-Cookie',serialize(cookieName,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'Strict',path:'/',maxAge:28800}));return true}
export function clearSession(res){res.setHeader('Set-Cookie',serialize(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'Strict',path:'/',maxAge:0}))}
