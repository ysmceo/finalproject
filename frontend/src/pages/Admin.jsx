import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import legacyHtml from "@/legacy/admin.html?raw";
import { initAdmin } from "@/legacy/admin";
import AdminProductForm from "@/components/forms/AdminProductForm";
import AdminDeliveryFeeForm from "@/components/forms/AdminDeliveryFeeForm";

import "@/styles/legacy-admin.css";

export default function Admin() {
  const [mountNodes, setMountNodes] = useState(null);

  useEffect(() => {
    setMountNodes({
      productForm: document.getElementById("productFormMount"),
      deliveryFeeForm: document.getElementById("productDeliveryFeeFormMount")
    });
  }, []);

  const ready = useMemo(
    () => mountNodes && mountNodes.productForm && mountNodes.deliveryFeeForm,
    [mountNodes]
  );

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      initAdmin();
    }, 0);
    return () => clearTimeout(id);
  }, [ready]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div dangerouslySetInnerHTML={{ __html: legacyHtml }} />
      {ready && createPortal(<AdminProductForm />, mountNodes.productForm)}
      {ready && createPortal(<AdminDeliveryFeeForm />, mountNodes.deliveryFeeForm)}
    </div>
  );
}
