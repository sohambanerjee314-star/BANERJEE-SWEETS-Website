import { supabase } from './supabase.js';

/**
 * =================================================================
 * PRODUCT CATEGORIES CRUD API MODULE
 * =================================================================
 */

/**
 * 1. CREATE: Add a new category
 * @param {Object} category - Category payload { name, slug, description, image_url, is_active }
 * @returns {Promise<Object>} Created category record
 */
export async function createCategory(category) {
  if (!category.name) {
    throw new Error('Category name is required');
  }

  // Auto-generate slug if not provided
  const slug = category.slug || category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const payload = {
    name: category.name,
    slug: slug,
    description: category.description || '',
    image_url: category.image_url || null,
    is_active: category.is_active !== undefined ? category.is_active : true,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('categories')
    .insert([payload])
    .select();

  if (error) {
    console.error('Error creating category:', error);
    throw error;
  }

  return data ? data[0] : null;
}

/**
 * 2. READ (ALL): Fetch all categories
 * @param {Boolean} onlyActive - Filter by active status (default: false to fetch all)
 * @returns {Promise<Array>} List of category objects
 */
export async function getCategories(onlyActive = false) {
  let query = supabase.from('categories').select('*');

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }

  return data || [];
}

/**
 * 3. READ (SINGLE BY ID): Get single category by ID
 * @param {String} id - Category UUID
 * @returns {Promise<Object|null>} Category object or null
 */
export async function getCategoryById(id) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Error fetching category with ID ${id}:`, error);
    return null;
  }

  return data;
}

/**
 * 4. READ (SINGLE BY SLUG): Get single category by Slug
 * @param {String} slug - Category URL slug
 * @returns {Promise<Object|null>} Category object or null
 */
export async function getCategoryBySlug(slug) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error(`Error fetching category with slug ${slug}:`, error);
    return null;
  }

  return data;
}

/**
 * 5. UPDATE: Update category by ID
 * @param {String} id - Category UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated category record
 */
export async function updateCategory(id, updates) {
  if (!id) {
    throw new Error('Category ID is required for update');
  }

  // Auto-generate slug if name updated but slug omitted
  if (updates.name && !updates.slug) {
    updates.slug = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    console.error(`Error updating category ${id}:`, error);
    throw error;
  }

  return data ? data[0] : null;
}

/**
 * 6. DELETE: Delete category by ID
 * @param {String} id - Category UUID
 * @returns {Promise<Boolean>} Success status
 */
export async function deleteCategory(id) {
  if (!id) {
    throw new Error('Category ID is required for deletion');
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting category ${id}:`, error);
    throw error;
  }

  return true;
}
