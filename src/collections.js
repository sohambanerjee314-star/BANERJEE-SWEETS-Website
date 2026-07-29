import { supabase } from './supabase.js';
import {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory
} from './categoriesApi.js';

import {
  getProducts,
  createProduct,
  updateProduct,
  toggleProductStock,
  toggleProductVisibility,
  toggleProductBadge,
  deleteProduct,
  uploadProductImage,
  uploadAvatarImage,
  removeAvatarImage
} from './productsApi.js';

export {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  getProducts,
  createProduct,
  updateProduct,
  toggleProductStock,
  toggleProductVisibility,
  toggleProductBadge,
  deleteProduct,
  uploadProductImage,
  uploadAvatarImage,
  removeAvatarImage
};

// ================= 3. CART COLLECTION =================
export async function getCartItems(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('cart_items')
    .select('*, products(*)')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching cart items:', error);
    return [];
  }
  return data;
}

export async function addToCart(userId, productId, quantity = 1) {
  if (!userId || !productId) return null;
  
  const { data, error } = await supabase
    .from('cart_items')
    .upsert({ user_id: userId, product_id: productId, quantity: quantity }, { onConflict: 'user_id,product_id' })
    .select();

  if (error) {
    console.error('Error adding item to cart:', error);
    throw error;
  }
  return data;
}

export async function removeFromCart(cartItemId) {
  const { data, error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId);

  if (error) {
    console.error('Error removing cart item:', error);
    throw error;
  }
  return data;
}

// ================= 4. ORDERS COLLECTION =================
export async function createOrder(orderPayload) {
  const { data, error } = await supabase
    .from('orders')
    .insert([orderPayload])
    .select();

  if (error) {
    console.error('Error creating order:', error);
    throw error;
  }
  return data ? data[0] : null;
}

export async function getUserOrders(userIdOrEmail) {
  let query = supabase.from('orders').select('*');
  if (userIdOrEmail) {
    query = query.or(`user_id.eq.${userIdOrEmail},user_email.ilike.${userIdOrEmail}`);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching user orders:', error);
    return [];
  }
  return data;
}

// ================= 5. REVIEWS COLLECTION =================
export async function getProductReviews(productId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching product reviews:', error);
    return [];
  }
  return data;
}

export async function addProductReview(reviewPayload) {
  const { data, error } = await supabase
    .from('reviews')
    .insert([reviewPayload])
    .select();

  if (error) {
    console.error('Error adding product review:', error);
    throw error;
  }
  return data ? data[0] : null;
}

// ================= 6. PAYMENTS COLLECTION =================
export async function recordPayment(paymentPayload) {
  const { data, error } = await supabase
    .from('payments')
    .insert([paymentPayload])
    .select();

  if (error) {
    console.error('Error recording payment:', error);
    throw error;
  }
  return data ? data[0] : null;
}
