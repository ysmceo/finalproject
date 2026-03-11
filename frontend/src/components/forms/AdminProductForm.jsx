import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminProductForm() {
  return (
    <form id="productForm" className="product-form">
      <div className="product-form-grid">
        <Input type="text" id="productName" placeholder="Product Name" required />
        <Input type="text" id="productCategory" placeholder="Category" required />
        <Input type="number" id="productPrice" placeholder="Price (₦)" min="0" required />
        <Input type="number" id="productStock" placeholder="Stock" min="0" required />
        <Label htmlFor="productImage" className="sr-only">
          Product Image
        </Label>
        <Input type="file" id="productImage" accept="image/*" />
      </div>
      <Button type="submit" className="btn btn-accept">
        Add Product
      </Button>
      <div id="productFormMessage" className="message"></div>
    </form>
  );
}
