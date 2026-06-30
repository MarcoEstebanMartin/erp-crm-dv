async function main() {
  // First login to get token
  const resLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password' }) // Assuming default password
  });
  const dataLogin = await resLogin.json();
  if(!dataLogin.data || !dataLogin.data.token) {
    console.log("Login failed", dataLogin);
    return;
  }
  const token = dataLogin.data.token;
  console.log("Token:", token.substring(0, 10));

  const resDrawers = await fetch('http://localhost:3000/api/finance/drawers/active', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const dataDrawers = await resDrawers.json();
  console.log("Active Drawer Response:", JSON.stringify(dataDrawers));
  
  const resDrawersAll = await fetch('http://localhost:3000/api/finance/drawers/active-all', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const dataDrawersAll = await resDrawersAll.json();
  console.log("Active Drawers All Response:", JSON.stringify(dataDrawersAll));
}
main();
