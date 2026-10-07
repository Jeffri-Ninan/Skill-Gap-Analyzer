const API_BASE="/api";

export async function apiRequest(path,options={}) {
  let response;
  try {
    response=await fetch(`${API_BASE}${path}`,{
      ...options,
      credentials:"same-origin",
      headers:{"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...options.headers}
    });
  } catch(error) {
    throw new Error("The server could not be reached. Check your connection and try again.",{cause:error});
  }
  if(response.status===204)return null;
  const contentType=response.headers.get("content-type")??"";
  const body=contentType.includes("application/json")?await response.json():null;
  if(!response.ok) {
    const detail=body?.detail;
    if(response.status===401&&!["/auth/login","/auth/register","/auth/me"].includes(path)) {
      window.dispatchEvent(new CustomEvent("skillgap:unauthorized"));
    }
    const error=new Error(typeof detail==="string"?detail:(response.status===401?"Please sign in to continue.":"The request could not be completed."));
    error.status=response.status;
    throw error;
  }
  return body;
}
