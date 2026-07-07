import { useParams } from "react-router-dom";

export default function ShopRelease() {
  const { shopId } = useParams();
  return <div>Shop release — shop: {shopId}</div>;
}
