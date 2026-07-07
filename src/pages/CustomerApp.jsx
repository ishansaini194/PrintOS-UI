import { useParams } from "react-router-dom";

export default function CustomerApp() {
  const { shopId } = useParams();
  return <div>Customer app — shop: {shopId}</div>;
}
