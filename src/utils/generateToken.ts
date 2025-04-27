import jwt from 'jsonwebtoken';

// 定义系统类型
type TokenType = 'user' | 'customer';

// 用户和客户使用不同的加密算法
const generateToken = (id: string, type: TokenType = 'user'): string => {
  const payload = { sub: id, iat: Math.floor(Date.now() / 1000), type };

  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRE,
    algorithm: type === 'user' ? 'HS256' : 'HS512',
  });
};

const generateRefreshToken = (id: string, type: TokenType = 'user'): string => {
  const payload = { sub: id, iat: Math.floor(Date.now() / 1000), type };

  return jwt.sign(payload, process.env.REFRESH_JWT_SECRET as string, {
    expiresIn: process.env.REFRESH_JWT_EXPIRE,
    algorithm: type === 'user' ? 'HS256' : 'HS512',
  });
};

export { generateToken, generateRefreshToken };
