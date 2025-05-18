export const isAuthenticated = () => {
    return !!localStorage.getItem('access_token');
  };
  
  export const getAccessToken = () => {
    return localStorage.getItem('access_token');
  };
  
  export const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  };

  export const getToken = () => {
    return localStorage.getItem('access_token');
  };
  
  