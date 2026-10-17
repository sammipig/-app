// FitBudget food vision API. Deploy as a Cloudflare Worker.
// Configure OPENAI_API_KEY and FITBUDGET_ACCESS_TOKEN as encrypted Worker secrets.
const ORIGIN = "https://sammipig.github.io";
function cors(origin){return {"Access-Control-Allow-Origin":origin===ORIGIN?ORIGIN:"null","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, X-FitBudget-Token","Vary":"Origin"}}
function reply(data,status,origin){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors(origin),"Cache-Control":"no-store"}})}
export default {async fetch(request,env){
const origin=request.headers.get("Origin")||"";
if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
if(new URL(request.url).pathname!=="/analyze"||request.method!=="POST")return reply({error:"Not found"},404,origin);
if(origin!==ORIGIN)return reply({error:"Origin not allowed"},403,origin);
if(!env.OPENAI_API_KEY||!env.FITBUDGET_ACCESS_TOKEN)return reply({error:"Worker secrets are not configured"},503,origin);
const token=request.headers.get("X-FitBudget-Token")||"";
if(!token||token!==env.FITBUDGET_ACCESS_TOKEN)return reply({error:"Access token invalid"},401,origin);
const len=Number(request.headers.get("content-length")||0);
if(len>2100000)return reply({error:"Image too large"},413,origin);
let body;try{body=await request.json()}catch{return reply({error:"Invalid JSON"},400,origin)}
const image=body?.image;
if(typeof image!=="string"||image.length>1900000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))return reply({error:"Invalid image"},400,origin);
try{
const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",temperature:0.2,response_format:{type:"json_object"},messages:[{role:"system",content:"You are a food-photo assistant. Return ONLY a JSON object with food_name (Traditional Chinese string), serving (Traditional Chinese string), estimated_kcal (integer or null), ingredients (array of Traditional Chinese strings), uncertainty (Traditional Chinese string). Describe only visible food. Estimate a plausible kcal for the whole photographed portion only when possible; do not invent precise weights or ingredients, and clearly note oil/sauce/hidden portions cannot be known. Never recommend calorie restriction, fasting, or weight loss."},{role:"user",content:[{type:"text",text:"辨識這張餐點照片的食物、可能份量和粗略熱量。無法判定時使用 null，提醒使用者確認份量與烹調方式。"},{"type":"image_url",image_url:{url:image,detail:"low"}}]}]})});
if(!response.ok)return reply({error:"AI service unavailable",code:response.status},502,origin);
const raw=await response.json(),parsed=JSON.parse(raw.choices?.[0]?.message?.content||"{}");
return reply({food_name:String(parsed.food_name||"").slice(0,120),serving:String(parsed.serving||"").slice(0,100),estimated_kcal:Number.isFinite(parsed.estimated_kcal)&&parsed.estimated_kcal>=0&&parsed.estimated_kcal<=10000?Math.round(parsed.estimated_kcal):null,ingredients:Array.isArray(parsed.ingredients)?parsed.ingredients.map(String).slice(0,12):[],uncertainty:String(parsed.uncertainty||"請自行確認份量與烹調方式").slice(0,300)},200,origin)
}catch(e){return reply({error:"Could not analyze image"},502,origin)}
}};