import axios from 'axios';

// Shared API client. The refresh token travels in an httpOnly cookie; AuthContext sets the bearer header.
const api = axios.create({
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

export default api;
