import { supabase } from './supabase.js';

/**
 * =================================================================
 * PRODUCT MANAGEMENT, VISIBILITY, BADGES & STOCK CRUD API MODULE
 * =================================================================
 */

/**
 * Upload product image file to Supabase Storage bucket 'products'
 * @param {File} file - Image file selected by Admin from device
 * @returns {Promise<String>} Public URL of uploaded image
 */
export async function uploadProductImage(file) {
  if (!file) throw new Error('No image file selected.');

  const fileExt = file.name.split('.').pop();
  const fileName = `sweet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `catalog/${fileName}`;

  const { data, error } = await supabase.storage
    .from('products')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading product image to Supabase Storage:', error);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('products')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

/**
 * Upload user profile picture to Supabase Storage bucket 'avatars'
 * @param {File} file - Profile image file selected from device
 * @param {String} userId - Current user ID
 * @returns {Promise<String>} Public URL of uploaded avatar image
 */
export async function uploadAvatarImage(file, userId, email = null) {
  if (!file) throw new Error('No avatar image file selected.');

  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `avatar_${userId || 'user'}_${Date.now()}.${fileExt}`;
  const filePath = `profiles/${fileName}`;

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading avatar to Supabase Storage:', error);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  // Persist avatar_url in Supabase Auth user metadata
  const { error: updateErr } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl }
  });

  if (updateErr) {
    console.warn('Could not update auth metadata avatar_url:', updateErr);
  }

  // Dual persist via RPC to ensure database raw_user_metadata is always updated
  try {
    await supabase.rpc('update_user_avatar_direct', {
      p_user_id: userId || null,
      p_avatar_url: publicUrl,
      p_email: email || null
    });
  } catch (rpcErr) {
    console.warn('Could not update avatar via RPC update_user_avatar_direct:', rpcErr);
  }

  return publicUrl;
}

/**
 * Remove user profile picture from Supabase Auth metadata & database
 * @returns {Promise<Boolean>} Success status
 */
export async function removeAvatarImage(userId = null, email = null) {
  const { error } = await supabase.auth.updateUser({
    data: { avatar_url: null }
  });

  if (error) {
    console.error('Error removing profile picture metadata:', error);
  }

  try {
    await supabase.rpc('update_user_avatar_direct', {
      p_user_id: userId || null,
      p_avatar_url: null,
      p_email: email || null
    });
  } catch (rpcErr) {
    console.warn('Could not remove avatar via RPC update_user_avatar_direct:', rpcErr);
  }

  return true;
}

/**
 * Fetch all products
 * @param {Boolean} onlyAvailable - Filter by stock availability
 * @param {Boolean} includeHidden - Include hidden products (default: true for Admin, false for Customers)
 * @returns {Promise<Array>} List of products
 */
export async function getProducts(onlyAvailable = false, includeHidden = true) {
  let query = supabase.from('products').select('*, categories(name, slug)');

  if (onlyAvailable) {
    query = query.eq('is_available', true);
  }

  if (!includeHidden) {
    query = query.or('is_hidden.is.null,is_hidden.eq.false');
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  return data || [];
}

/**
 * Create a new product
 * @param {Object} productPayload - { name, category_id, price, unit, description, image_url, is_available, is_hidden, badge }
 * @returns {Promise<Object>} Created product object
 */
export async function createProduct(productPayload) {
  if (!productPayload.name || !productPayload.price) {
    throw new Error('Product name and price are required.');
  }

  const slug = productPayload.slug || productPayload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const payload = {
    name: productPayload.name,
    slug: slug,
    category_id: productPayload.category_id || null,
    price: parseFloat(productPayload.price),
    unit: productPayload.unit || '250g',
    description: productPayload.description || '',
    image_url: productPayload.image_url || null,
    is_available: productPayload.is_available !== undefined ? productPayload.is_available : true,
    is_hidden: productPayload.is_hidden !== undefined ? productPayload.is_hidden : false,
    badge: productPayload.badge || null,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('products')
    .insert([payload])
    .select();

  if (error) {
    console.error('Error creating product:', error);
    throw error;
  }
  return data ? data[0] : null;
}

/**
 * Update product details (name, category, price, weight/unit, description, visibility, image_url, badge, etc.)
 * @param {String} id - Product UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated product object
 */
export async function updateProduct(id, updates) {
  if (!id) throw new Error('Product ID is required for update.');

  if (updates.name && !updates.slug) {
    updates.slug = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  if (updates.price !== undefined) {
    updates.price = parseFloat(updates.price);
  }

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    console.error(`Error updating product ${id}:`, error);
    throw error;
  }
  return data ? data[0] : null;
}

/**
 * Toggle Product Stock Status (In Stock vs Out of Stock)
 * @param {String} id - Product UUID
 * @param {Boolean} isAvailable - Stock availability boolean
 * @returns {Promise<Object>} Updated product object
 */
export async function toggleProductStock(id, isAvailable) {
  return await updateProduct(id, { is_available: isAvailable });
}

/**
 * Toggle Product Store Visibility (Show Product vs Hide Product)
 * @param {String} id - Product UUID
 * @param {Boolean} isHidden - True to hide product from customer website, false to show
 * @returns {Promise<Object>} Updated product object
 */
export async function toggleProductVisibility(id, isHidden) {
  return await updateProduct(id, { is_hidden: isHidden });
}

/**
 * Toggle or Set Product Badge (Best Seller, New, Signature, Classic, Special, None)
 * @param {String} id - Product UUID
 * @param {String|null} badge - Badge label string or null
 * @returns {Promise<Object>} Updated product object
 */
export async function toggleProductBadge(id, badge) {
  return await updateProduct(id, { badge: badge || null });
}

/**
 * Delete a product by ID
 * @param {String} id - Product UUID
 * @returns {Promise<Boolean>} Success status
 */
export async function deleteProduct(id) {
  if (!id) throw new Error('Product ID is required for deletion.');

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting product ${id}:`, error);
    throw error;
  }
  return true;
}
