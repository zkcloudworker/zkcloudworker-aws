import jwt from "jsonwebtoken";
const JWT_PRIVATEKEY = process.env.JWT_PRIVATEKEY!;

export function generateJWT(
  id: string,
  expires_sec: number = 365 * 24 * 60 * 60, // one year
) {
  const options = {
    expiresIn: expires_sec,
  };
  const token = jwt.sign({ id }, JWT_PRIVATEKEY, options);
  console.log("generateJWT Token", token, "verify", verifyJWT(token), "id", id);
  return token;
}

export function verifyJWT(token: string): string | undefined {
  try {
    const result: any = jwt.verify(token, JWT_PRIVATEKEY);
    if (result.id && result.id != "") return result.id;
    else {
      console.error("verifyJWT - Wrong token", token, result);
      return undefined;
    }
  } catch (error) {
    console.error("verifyJWT catch - Wrong token", token, error);
    return undefined;
  }
}
