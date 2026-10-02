/* Picks where the data comes from:
 *   • supabaseUrl + supabaseKey filled in (js/config.js) → the real lab database
 *   • otherwise → demo data stored in this browser
 * Add ?demo to the address to force the demo, e.g. .../app/?demo
 */
window.LAB = window.LAB || {};

LAB.createBackend = function () {
  const C = LAB.CONFIG || {};
  const forceDemo = new URLSearchParams(location.search).has('demo');
  if (!forceDemo && C.supabaseUrl && C.supabaseKey && LAB.createSupabaseBackend) {
    return LAB.createSupabaseBackend(C.supabaseUrl, C.supabaseKey);
  }
  return LAB.createDemoBackend();
};
