
export interface OFFProduct {
  product_name?: string;
  ingredients_text?: string;
  ingredients_text_ar?: string;
  ingredients_text_en?: string;
  image_url?: string;
}

export const fetchProductByBarcode = async (barcode: string): Promise<OFFProduct | null> => {
  const MAX_RETRIES = 3;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (!response.ok) {
          if (attempt === MAX_RETRIES) return null;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
      }
      
      const data = await response.json();
      if (data.status === 1 && data.product) {
         return {
           product_name: data.product.product_name || data.product.product_name_en || data.product.product_name_ar,
           ingredients_text: data.product.ingredients_text,
           ingredients_text_ar: data.product.ingredients_text_ar,
           ingredients_text_en: data.product.ingredients_text_en,
           image_url: data.product.image_front_url
         };
      }
      return null;
    } catch (e) {
      console.error("OFF Fetch Error", e);
      if (attempt === MAX_RETRIES) return null;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  return null;
};
