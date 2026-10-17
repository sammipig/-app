// FitBudget food vision API. Deploy as a Cloudflare Worker.
// Configure GEMINI_API_KEY and FITBUDGET_ACCESS_TOKEN as encrypted Worker secrets.
const ORIGIN = "https://sammipig.github.io";
function cors(origin){return {"Access-Control-Allow-Origin":origin===ORIGIN?ORIGIN:"null","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, X-FitBudget-Token","Vary":"Origin"}}
function reply(data,status,origin){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors(origin),"Cache-Control":"no-store"}})}
export default {async fetch(request,env){
const origin=request.headers.get("Origin")||"";
if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
if(new URL(request.url).pathname!=="/analyze"||request.method!=="POST")return reply({error:"Not found"},404,origin);
if(origin!==ORIGIN)return reply({error:"Origin not allowed"},403,origin);
if(!env.GEMINI_API_KEY||!env.FITBUDGET_ACCESS_TOKEN)return reply({error:"Worker secrets are not configured"},503,origin);
const token=request.headers.get("X-FitBudget-Token")||"";
if(!token||token!==env.FITBUDGET_ACCESS_TOKEN)return reply({error:"Access token invalid"},401,origin);
const len=Number(request.headers.get("content-length")||0);
if(len>2100000)return reply({error:"Image too large"},413,origin);
let body;try{body=await request.json()}catch{return reply({error:"Invalid JSON"},400,origin)}
const image=body?.image;
if(typeof image!=="string"||image.length>1900000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))return reply({error:"Invalid image"},400,origin);
try{
const prompt="Analyze the food photo and return ONLY JSON with food_name (Traditional Chinese string), serving (Traditional Chinese string), estimated_kcal (integer or null), ingredients (array of Traditional Chinese strings), uncertainty (Traditional Chinese string). Describe only visible foods. If portions cannot be estimated, use null. Explain cooking oil, sauces and hidden ingredients cannot be determined. Do not recommend restrictive dieting, fasting or weight loss.";
const comma=image.indexOf(","),mime=image.slice(5,image.indexOf(";")),base64=image.slice(comma+1);
const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",{method:"POST",headers:{"x-goog-api-key":env.GEMINI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt},{inline_data:{mime_type:mime,data:base64}}]}],generationConfig:{responseMimeType:"application/json",temperature:0.2,maxOutputTokens:800}})});
if(response.status===429)return reply({error:"Gemini free-tier limit reached. Please try later.",code:429},429,origin);
if(!response.ok)return reply({error:"Gemini service unavailable",code:response.status},502,origin);
const raw=await response.json(),parts=raw.candidates?.[0]?.content?.parts||[],message=parts.map(p=>p.text||"").join(""),parsed=JSON.parse(message||"{}");
return reply({food_name:String(parsed.food_name||"").slice(0,120),serving:String(parsed.serving||"").slice(0,100),estimated_kcal:Number.isFinite(parsed.estimated_kcal)&&parsed.estimated_kcal>=0&&parsed.estimated_kcal<=10000?Math.round(parsed.estimated_kcal):null,ingredients:Array.isArray(parsed.ingredients)?parsed.ingredients.map(String).slice(0,12):[],uncertainty:String(parsed.uncertainty||"請自行確認份量與烹調方式").slice(0,300)},200,origin)
}catch(e){return reply({error:"Could not analyze image"},502,origin)}
}};