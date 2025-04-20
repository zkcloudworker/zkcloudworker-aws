import { SignJWT, jwtVerify } from "jose";
const JWT_PRIVATEKEY = process.env.JWT_PRIVATEKEY!;

// export function generateJWT(
//   data: any,
//   expires_sec: number = 365 * 24 * 60 * 60 // one year
// ) {
//   const { id, auth } = data;
//   if (auth !== process.env.JWT_ACCESS_KEY) {
//     console.error("generateJWT - Wrong auth", auth);
//     return undefined;
//   }
//   if (id === undefined || id === "") {
//     console.error("generateJWT - Wrong id", id);
//     return undefined;
//   }
//   const regex = /^B62[1-9A-HJ-NP-Za-km-z]{52}$/;
//   if (!regex.test(id)) {
//     console.error("generateJWT - Wrong id", id);
//     return undefined;
//   }
//   const options = {
//     expiresIn: expires_sec,
//   };
//   const token = jwt.sign({ id }, JWT_PRIVATEKEY, options);
//   const recoveredId = verifyJWT(token);
//   if (recoveredId !== id) {
//     console.error("generateJWT - Wrong id", id, "recoveredId", recoveredId);
//     return undefined;
//   }
//   console.log("generated JWT Token for id", id);
//   return token;
// }

// export function verifyJWT(token: string): string | undefined {
//   try {
//     const result: any = jwt.verify(token, JWT_PRIVATEKEY);
//     if (result.id && result.id != "") return result.id;
//     else {
//       console.error("verifyJWT - Wrong token", token, result);
//       return undefined;
//     }
//   } catch (error) {
//     console.error("verifyJWT catch - Wrong token", token, error);
//     return undefined;
//   }
// }

export async function verifyJWT(token: string): Promise<string | undefined> {
  try {
    const result = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_PRIVATEKEY)
    );
    if (
      result?.payload?.id &&
      typeof result.payload.id === "string" &&
      result.payload.id != ""
    )
      return result.payload.id;
    else {
      console.error("verifyJWT - Wrong token", token, result);
      return undefined;
    }
  } catch (error) {
    console.error("verifyJWT catch - Wrong token", token, error);
    return undefined;
  }
}
