/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // 同源代理：前端一律请求相对路径 /api/*，由 Next 转发到后端。
  // 浏览器只面对一个源 → HttpOnly 会话 cookie / CSRF cookie 都是第一方，
  // 刷新恢复与 CSRF 双提交不再受 127.0.0.1 / localhost 跨站影响。
  // 后端地址用 BACKEND_ORIGIN 覆盖（默认本机 8000）。
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
