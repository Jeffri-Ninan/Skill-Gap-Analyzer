const ROUTES=new Set(["profile","analyze","results","history","plan"]);
export function routeFromHash(hasProfile=false) {
  const requested=location.hash.replace(/^#\/?/,"").split("?")[0];
  if(!requested)return hasProfile?"analyze":"profile";
  return ROUTES.has(requested)?requested:(hasProfile?"analyze":"profile");
}
export function initializeRouter(onRoute,hasProfile=()=>false) {
  const navigate=()=>onRoute(routeFromHash(hasProfile()));
  window.addEventListener("hashchange",navigate);
  if(!location.hash)location.hash="#/"+routeFromHash(hasProfile());
  else navigate();
}
