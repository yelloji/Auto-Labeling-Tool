// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://work-1-digwbshcauwokcgm.prod-runtime.all-hands.dev'  // Backend on port 12000
  : 'http://localhost:12000';  // Backend on port 12000 (correct port)

export { API_BASE_URL };