import { BrowserRouter, Routes, Route } from "react-router-dom";
import CustomerApp from "./pages/CustomerApp";
import ShopRelease from "./pages/ShopRelease";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/s/:shopId" element={<CustomerApp />} />
        <Route path="/shop/:shopId/release" element={<ShopRelease />} />
        <Route path="*" element={<div>PrintOS</div>} />
      </Routes>
    </BrowserRouter>
  );
}
