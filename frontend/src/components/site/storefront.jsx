import { QuantityControl } from "@/components/site/shared";
import { formatCurrency } from "@/lib/site";

export function ProductPicker({ products, quantities, onChange, emptyText = "Products will load here." }) {
  if (!products.length) {
    return (
      <div className="rounded-[1.6rem] border border-dashed border-line bg-panel/72 px-5 py-6 text-sm text-ink-soft">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {products.map((product) => (
        <div
          key={product.id}
          className="flex flex-col gap-3 rounded-[1.4rem] border border-line/70 bg-panel/92 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-ink">{product.name}</p>
            <p className="text-sm text-ink-soft">
              {product.category || "Salon product"} | {formatCurrency(product.price)} | Stock:{" "}
              {Number(product.stock || 0)}
            </p>
          </div>
          <QuantityControl
            max={Math.max(0, Number(product.stock || 0))}
            onChange={(value) => onChange(product.id, value)}
            value={Number(quantities[product.id] || 0)}
          />
        </div>
      ))}
    </div>
  );
}
