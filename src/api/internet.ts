import axios from "axios";

export async function checkInternet() {
  const result = await axios.get(
    "https://ipfs.io/ipfs/QmWMYpasm5FZriTQsiJdNjyJnbyMAn4mRCoboga6EVdGeu"
  );
  if (result.data !== undefined) console.log(result.data);
  else console.log("ERROR: no internet connection");
}
