export function saveToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function clearToken() {
  localStorage.removeItem("access_token");
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem("access_token");
}
