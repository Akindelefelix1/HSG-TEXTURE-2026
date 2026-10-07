"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Edit3, Eye, EyeOff, FolderPlus, LayoutDashboard, LogOut, Package, Plus, Search, Settings, Trash2, X } from "lucide-react";
import { ADMIN_ACCOUNT_KEY, ADMIN_CATEGORIES_KEY, ADMIN_PRODUCTS_KEY, ADMIN_SESSION_KEY, defaultAdminCategories, defaultAdminProducts, makeAdminId, migrateAdminCatalog } from "@/lib/catalog-admin";
import { formatNaira } from "@/lib/storefront";
import type { Category, Product } from "@/types/storefront";

type AdminAccount={email:string;passwordHash:string};
type AdminTab="dashboard"|"products"|"categories"|"settings";
type CatalogSection="fabric"|"accessories";
type ProductDraft={section:CatalogSection;name:string;category:string;price:string;color:string;texture:string;description:string;badge:string;active:boolean};
const emptyProduct:ProductDraft={section:"fabric",name:"",category:"",price:"",color:"#183b8f",texture:"woven",description:"",badge:"",active:true};

async function hashPassword(value:string){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

function readLocal<T>(key:string,fallback:T):T{
  try{const value=window.localStorage.getItem(key);return value?JSON.parse(value) as T:fallback}catch{return fallback}
}

export function AdminDashboard(){
  const [ready,setReady]=useState(false);
  const [authenticated,setAuthenticated]=useState(false);
  const [hasAccount,setHasAccount]=useState(false);
  const [authError,setAuthError]=useState("");
  const [tab,setTab]=useState<AdminTab>("dashboard");
  const [catalogSection,setCatalogSection]=useState<CatalogSection>("fabric");
  const [products,setProducts]=useState<Product[]>(defaultAdminProducts);
  const [categories,setCategories]=useState<Category[]>(defaultAdminCategories);
  const [search,setSearch]=useState("");
  const [productModal,setProductModal]=useState(false);
  const [editingProduct,setEditingProduct]=useState<string|null>(null);
  const [draft,setDraft]=useState<ProductDraft>(emptyProduct);
  const [categoryName,setCategoryName]=useState("");
  const [categoryNote,setCategoryNote]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    migrateAdminCatalog();
    // Browser storage is the external source of truth for the local admin bootstrap.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasAccount(Boolean(window.localStorage.getItem(ADMIN_ACCOUNT_KEY)));
    setAuthenticated(window.sessionStorage.getItem(ADMIN_SESSION_KEY)==="active");
    setProducts(readLocal(ADMIN_PRODUCTS_KEY,defaultAdminProducts));
    setCategories(readLocal(ADMIN_CATEGORIES_KEY,defaultAdminCategories));
    setReady(true);
  },[]);

  const persistProducts=(next:Product[])=>{setProducts(next);window.localStorage.setItem(ADMIN_PRODUCTS_KEY,JSON.stringify(next));window.dispatchEvent(new Event("hsg-catalog-updated"))};
  const persistCategories=(next:Category[])=>{setCategories(next);window.localStorage.setItem(ADMIN_CATEGORIES_KEY,JSON.stringify(next));window.dispatchEvent(new Event("hsg-catalog-updated"))};
  const flash=(message:string)=>{setNotice(message);window.setTimeout(()=>setNotice(""),2400)};

  const authenticate=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setAuthError("");
    const data=new FormData(event.currentTarget);
    const email=String(data.get("email")||"").trim().toLowerCase();
    const password=String(data.get("password")||"");
    if(!email||password.length<8){setAuthError("Enter a valid email and a password of at least 8 characters.");return}
    const passwordHash=await hashPassword(password);
    if(!hasAccount){
      window.localStorage.setItem(ADMIN_ACCOUNT_KEY,JSON.stringify({email,passwordHash} satisfies AdminAccount));
      setHasAccount(true);
    }else{
      const account=readLocal<AdminAccount|null>(ADMIN_ACCOUNT_KEY,null);
      if(!account||account.email!==email||account.passwordHash!==passwordHash){setAuthError("The email or password is incorrect.");return}
    }
    window.sessionStorage.setItem(ADMIN_SESSION_KEY,"active");setAuthenticated(true);
  };

  const logout=()=>{window.sessionStorage.removeItem(ADMIN_SESSION_KEY);setAuthenticated(false);setTab("dashboard")};
  const activeProducts=products.filter(product=>product.active!==false);
  const inactiveProducts=products.length-activeProducts.length;
  const activeCategories=categories.filter(category=>category.active!==false);
  const sectionCategories=categories.filter(category=>(category.section??"fabric")===catalogSection);
  const inventoryValue=activeProducts.reduce((sum,product)=>sum+product.price,0);
  const filteredProducts=useMemo(()=>products.filter(product=>(product.section??"fabric")===catalogSection&&`${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase())),[products,catalogSection,search]);

  const openProduct=(product?:Product)=>{
    setEditingProduct(product?.id??null);
    const section=(product?.section??catalogSection) as CatalogSection;
    const availableCategories=categories.filter(category=>(category.section??"fabric")===section&&category.active!==false);
    setDraft(product?{section,name:product.name,category:product.category,price:String(product.price),color:product.color,texture:product.texture,description:product.description??"",badge:product.badge??"",active:product.active!==false}:{...emptyProduct,section,category:availableCategories[0]?.name??""});
    setProductModal(true);
  };
  const saveProduct=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const value:Product={id:editingProduct??makeAdminId("product"),section:draft.section,name:draft.name.trim(),category:draft.category,price:Number(draft.price),color:draft.color,texture:draft.texture.trim()||"woven",description:draft.description.trim()||undefined,badge:draft.badge.trim()||undefined,active:draft.active};
    if(!value.name||!value.category||!Number.isFinite(value.price)||value.price<=0)return;
    persistProducts(editingProduct?products.map(product=>product.id===editingProduct?value:product):[value,...products]);
    setProductModal(false);flash(editingProduct?"Product updated successfully.":"Product created successfully.");
  };
  const removeProduct=(product:Product)=>{if(window.confirm(`Delete ${product.name}? This cannot be undone.`)){persistProducts(products.filter(item=>item.id!==product.id));flash("Product deleted.")}};
  const toggleProduct=(id:string|undefined)=>{persistProducts(products.map(product=>product.id===id?{...product,active:product.active===false}:product));flash("Product status updated.")};
  const addCategory=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const name=categoryName.trim();if(!name||sectionCategories.some(category=>category.name.toLowerCase()===name.toLowerCase()))return;persistCategories([...categories,{id:makeAdminId("category"),section:catalogSection,name,note:categoryNote.trim(),active:true}]);setCategoryName("");setCategoryNote("");flash(`${catalogSection==="fabric"?"Fabric":"Accessory"} category created.`)};
  const toggleCategory=(id:string|undefined)=>{persistCategories(categories.map(category=>category.id===id?{...category,active:category.active===false}:category));flash("Category status updated.")};
  const removeCategory=(category:Category)=>{if(products.some(product=>product.category===category.name)){window.alert("Move or delete products in this category before deleting it.");return}if(window.confirm(`Delete ${category.name}?`)){persistCategories(categories.filter(item=>item.id!==category.id));flash("Category deleted.")}};
  const resetCatalog=()=>{if(window.confirm("Restore all original products and categories? Your admin changes will be replaced.")){persistProducts(defaultAdminProducts);persistCategories(defaultAdminCategories);flash("Original catalogue restored.")}};

  if(!ready)return <main className="admin-loading">Loading admin…</main>;
  if(!authenticated)return <main className="admin-auth"><section className="admin-login-card"><Link href="/" className="admin-login-logo"><span className="brand-logo" aria-hidden="true"/></Link><p className="eyebrow">Store administration</p><h1>{hasAccount?"Welcome back":"Create your admin account"}</h1><p>{hasAccount?"Sign in to manage the Hisgrace Texture storefront.":"Set up the first administrator for this browser."}</p><form onSubmit={authenticate}><label>Email address<input name="email" type="email" required autoComplete="username" placeholder="admin@hisgracetexture.com"/></label><label>Password<input name="password" type="password" required minLength={8} autoComplete={hasAccount?"current-password":"new-password"} placeholder="At least 8 characters"/></label>{authError&&<div className="admin-auth-error" role="alert">{authError}</div>}<button type="submit">{hasAccount?"Sign in":"Create account and continue"} <ChevronRight size={17}/></button></form><Link href="/">← Return to storefront</Link></section></main>;

  const navigation:[AdminTab,string,React.ReactNode][]=[["dashboard","Overview",<LayoutDashboard key="d" size={18}/>],["products","Products",<Package key="p" size={18}/>],["categories","Categories",<FolderPlus key="c" size={18}/>],["settings","Settings",<Settings key="s" size={18}/>]];
  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-brand"><span className="brand-logo" aria-hidden="true"/><b>Admin</b></Link><nav>{navigation.map(([value,label,icon])=><button key={value} className={tab===value?"active":""} onClick={()=>setTab(value)}>{icon}{label}</button>)}</nav><div className="admin-sidebar-bottom"><Link href="/" target="_blank"><Eye size={17}/> View storefront</Link><button onClick={logout}><LogOut size={17}/> Sign out</button></div></aside><main className="admin-main"><header className="admin-topbar"><div><small>Hisgrace Texture</small><h1>{navigation.find(item=>item[0]===tab)?.[1]}</h1></div><span className="admin-avatar">A</span></header>{notice&&<div className="admin-notice" role="status"><Check size={17}/>{notice}</div>}
  {tab==="dashboard"&&<section className="admin-content"><div className="admin-welcome"><div><p className="eyebrow">Store overview</p><h2>Everything at a glance.</h2><p>Manage products, availability, and the collections customers see.</p></div><button onClick={()=>openProduct()}><Plus size={17}/> Add product</button></div><div className="admin-metrics"><article><span>Active products</span><b>{activeProducts.length}</b><small>{inactiveProducts} inactive</small></article><article><span>Categories</span><b>{activeCategories.length}</b><small>{categories.length-activeCategories.length} hidden</small></article><article><span>Catalogue value</span><b>{formatNaira(inventoryValue)}</b><small>One unit of every active item</small></article></div><div className="admin-panel"><div className="admin-panel-title"><div><h3>Recently managed products</h3><p>Quick access to your catalogue.</p></div><button onClick={()=>setTab("products")}>View all <ChevronRight size={15}/></button></div><ProductTable products={products.slice(0,6)} onEdit={openProduct} onToggle={toggleProduct} onDelete={removeProduct}/></div></section>}
  {tab==="products"&&<section className="admin-content"><SectionSwitch value={catalogSection} onChange={value=>{setCatalogSection(value);setSearch("")}} fabricCount={products.filter(product=>(product.section??"fabric")==="fabric").length} accessoriesCount={products.filter(product=>product.section==="accessories").length}/><div className="admin-page-actions"><div className="admin-search"><Search size={17}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={`Search ${catalogSection} products`}/></div><button onClick={()=>openProduct()}><Plus size={17}/> New {catalogSection==="fabric"?"fabric":"accessory"}</button></div><div className="admin-panel"><ProductTable products={filteredProducts} onEdit={openProduct} onToggle={toggleProduct} onDelete={removeProduct}/></div></section>}
  {tab==="categories"&&<section className="admin-content"><SectionSwitch value={catalogSection} onChange={setCatalogSection} fabricCount={categories.filter(category=>(category.section??"fabric")==="fabric").length} accessoriesCount={categories.filter(category=>category.section==="accessories").length}/><div className="admin-category-layout"><form className="admin-panel admin-category-form" onSubmit={addCategory}><p className="eyebrow">New {catalogSection==="fabric"?"fabric":"accessory"} collection</p><h3>Create category</h3><label>Category name<input value={categoryName} onChange={event=>setCategoryName(event.target.value)} required placeholder={catalogSection==="fabric"?"e.g. Italian Wool":"e.g. Watches"}/></label><label>Description<textarea value={categoryNote} onChange={event=>setCategoryNote(event.target.value)} rows={4} placeholder="A short customer-facing description"/></label><button><Plus size={17}/> Create category</button></form><div className="admin-panel"><div className="admin-panel-title"><div><h3>{catalogSection==="fabric"?"Fabric":"Accessory"} categories</h3><p>Show or hide collections across the storefront.</p></div></div><div className="admin-category-list">{sectionCategories.map(category=><article key={category.id}><div><span className={category.active===false?"status-dot off":"status-dot"}/><div><b>{category.name}</b><p>{category.note||"No description"}</p></div></div><div><button onClick={()=>toggleCategory(category.id)}>{category.active===false?<Eye size={16}/>:<EyeOff size={16}/>} {category.active===false?"Activate":"Deactivate"}</button><button className="danger" onClick={()=>removeCategory(category)} aria-label={`Delete ${category.name}`}><Trash2 size={16}/></button></div></article>)}</div></div></div></section>}
  {tab==="settings"&&<section className="admin-content"><div className="admin-panel admin-settings"><p className="eyebrow">Administration</p><h2>Store settings</h2><div className="admin-setting-row"><div><b>Storefront data</b><p>Restore the original product and category catalogue.</p></div><button className="danger-outline" onClick={resetCatalog}>Restore defaults</button></div><div className="admin-setting-row"><div><b>Admin session</b><p>Sign out of the dashboard on this device.</p></div><button onClick={logout}>Sign out</button></div><div className="admin-security-note"><b>Deployment note</b><p>This immediate version stores admin data in this browser. Before inviting multiple staff or managing live inventory across devices, connect the isolated catalogue layer to D1 and server-side authentication.</p></div></div></section>}
  </main>{productModal&&<div className="admin-modal-backdrop" onClick={()=>setProductModal(false)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={event=>event.stopPropagation()}><button className="admin-modal-close" onClick={()=>setProductModal(false)} aria-label="Close"><X/></button><p className="eyebrow">{draft.section==="fabric"?"Fabric":"Accessories"} catalogue</p><h2 id="product-modal-title">{editingProduct?"Edit product":"Create product"}</h2><form onSubmit={saveProduct}><label>Major section<select value={draft.section} onChange={event=>{const section=event.target.value as CatalogSection;const first=categories.find(category=>(category.section??"fabric")===section&&category.active!==false);setDraft({...draft,section,category:first?.name??""})}}><option value="fabric">Fabric</option><option value="accessories">Accessories</option></select></label><label>Category<select required value={draft.category} onChange={event=>setDraft({...draft,category:event.target.value})}><option value="">Select category</option>{categories.filter(category=>(category.section??"fabric")===draft.section&&category.active!==false).map(category=><option key={category.id} value={category.name}>{category.name}</option>)}</select></label><label className="wide">Product name<input required value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} placeholder="Product name"/></label><label>Price (₦)<input required type="number" min="1" value={draft.price} onChange={event=>setDraft({...draft,price:event.target.value})}/></label><label>Colour<input type="color" value={draft.color} onChange={event=>setDraft({...draft,color:event.target.value})}/></label><label>Texture style<input value={draft.texture} onChange={event=>setDraft({...draft,texture:event.target.value})} placeholder={draft.section==="fabric"?"woven":"fragrance"}/></label><label>Badge<input value={draft.badge} onChange={event=>setDraft({...draft,badge:event.target.value})} placeholder="New, Bestseller, Limited…"/></label><label className="wide">Description<input value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})} placeholder="Short product description"/></label><label className="admin-check wide"><input type="checkbox" checked={draft.active} onChange={event=>setDraft({...draft,active:event.target.checked})}/> Active and visible on storefront</label><div className="admin-modal-actions wide"><button type="button" onClick={()=>setProductModal(false)}>Cancel</button><button type="submit">{editingProduct?"Save changes":"Create product"}</button></div></form></section></div>}</div>;
}

function SectionSwitch({value,onChange,fabricCount,accessoriesCount}:{value:CatalogSection;onChange:(value:CatalogSection)=>void;fabricCount:number;accessoriesCount:number}){
  return <div className="admin-section-switch" aria-label="Catalogue section"><button className={value==="fabric"?"active":""} onClick={()=>onChange("fabric")}><span>Fabric</span><b>{fabricCount}</b></button><button className={value==="accessories"?"active":""} onClick={()=>onChange("accessories")}><span>Accessories</span><b>{accessoriesCount}</b></button></div>;
}

function ProductTable({products,onEdit,onToggle,onDelete}:{products:Product[];onEdit:(product:Product)=>void;onToggle:(id:string|undefined)=>void;onDelete:(product:Product)=>void}){
  if(!products.length)return <div className="admin-empty"><Package size={30}/><b>No products found</b><p>Try another search or create a product.</p></div>;
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{products.map(product=><tr key={product.id}><td><span className={`admin-product-swatch ${product.texture}`} style={{"--swatch":product.color} as React.CSSProperties}/><div><b>{product.name}</b><small>{product.badge||"Standard"}</small></div></td><td>{product.category}</td><td>{formatNaira(product.price)}</td><td><span className={product.active===false?"admin-status inactive":"admin-status"}>{product.active===false?"Inactive":"Active"}</span></td><td><button onClick={()=>onEdit(product)} aria-label={`Edit ${product.name}`}><Edit3 size={16}/></button><button onClick={()=>onToggle(product.id)} aria-label={`${product.active===false?"Activate":"Deactivate"} ${product.name}`}>{product.active===false?<Eye size={16}/>:<EyeOff size={16}/>}</button><button className="danger" onClick={()=>onDelete(product)} aria-label={`Delete ${product.name}`}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>;
}
