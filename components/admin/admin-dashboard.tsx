"use client";
/* Blob-backed admin previews cannot use the Next.js image optimizer. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Edit3, Eye, EyeOff, FolderPlus, ImagePlus, LayoutDashboard, LogOut, Monitor, Package, Plus, Search, Settings, Trash2, X } from "lucide-react";
import { ADMIN_ACCOUNT_KEY, ADMIN_CATEGORIES_KEY, ADMIN_PRODUCTS_KEY, ADMIN_SESSION_KEY, SITE_SETTINGS_KEY, defaultAdminCategories, defaultAdminProducts, defaultSiteSettings, makeAdminId, migrateAdminCatalog, type SiteSettings } from "@/lib/catalog-admin";
import { formatNaira } from "@/lib/storefront";
import type { Category, Product, ProductMedia } from "@/types/storefront";
import { AppDialog } from "@/components/ui/app-dialog";
import { deleteProductMedia, getProductMedia, saveProductMedia } from "@/lib/product-media";

type AdminAccount={email:string;passwordHash:string};
type AdminTab="dashboard"|"products"|"categories"|"settings";
type CatalogSection="fabric"|"accessories";
type DialogState={title:string;description:string;confirmLabel?:string;cancelLabel?:string|null;tone?:"default"|"danger"|"success";onConfirm?:()=>void};
type ProductDraft={section:CatalogSection;name:string;category:string;price:string;color:string;texture:string;description:string;badge:string;active:boolean};
type MediaDraft=ProductMedia&{url:string;file?:File};
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
  const [previewProduct,setPreviewProduct]=useState<Product|null>(null);
  const [draft,setDraft]=useState<ProductDraft>(emptyProduct);
  const [mediaDrafts,setMediaDrafts]=useState<MediaDraft[]>([]);
  const [coverMediaId,setCoverMediaId]=useState("");
  const [removedMediaIds,setRemovedMediaIds]=useState<string[]>([]);
  const [mediaError,setMediaError]=useState("");
  const [categoryName,setCategoryName]=useState("");
  const [categoryNote,setCategoryNote]=useState("");
  const [notice,setNotice]=useState("");
  const [siteSettings,setSiteSettings]=useState<SiteSettings>(defaultSiteSettings);
  const [heroPreview,setHeroPreview]=useState("");
  const [dialog,setDialog]=useState<DialogState|null>(null);

  useEffect(()=>{
    migrateAdminCatalog();
    // Browser storage is the external source of truth for the local admin bootstrap.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasAccount(Boolean(window.localStorage.getItem(ADMIN_ACCOUNT_KEY)));
    setAuthenticated(window.sessionStorage.getItem(ADMIN_SESSION_KEY)==="active");
    setProducts(readLocal(ADMIN_PRODUCTS_KEY,defaultAdminProducts));
    setCategories(readLocal(ADMIN_CATEGORIES_KEY,defaultAdminCategories));
    const settings=readLocal(SITE_SETTINGS_KEY,defaultSiteSettings);setSiteSettings(settings);if(settings.heroImageId)void getProductMedia(settings.heroImageId).then(blob=>{if(blob)setHeroPreview(URL.createObjectURL(blob))});
    setReady(true);
  },[]);

  useEffect(()=>{
    if(!productModal)return;
    const frame=requestAnimationFrame(()=>{
      document.querySelectorAll<HTMLElement>(".admin-media-grid article").forEach((element,index)=>{
        const media=mediaDrafts[index];if(!media)return;
        element.classList.toggle("cover",media.id===coverMediaId);
        element.tabIndex=0;element.setAttribute("role","button");element.setAttribute("aria-label",`${media.id===coverMediaId?"Cover media":"Set as cover"}: ${media.name}`);
        element.onclick=event=>{if((event.target as HTMLElement).closest("button"))return;setCoverMediaId(media.id)};
        element.onkeydown=event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setCoverMediaId(media.id)}};
      });
    });
    return()=>cancelAnimationFrame(frame);
  },[productModal,mediaDrafts,coverMediaId]);

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

  const openProduct=async(product?:Product)=>{
    setEditingProduct(product?.id??null);
    const section=(product?.section??catalogSection) as CatalogSection;
    const availableCategories=categories.filter(category=>(category.section??"fabric")===section&&category.active!==false);
    setDraft(product?{section,name:product.name,category:product.category,price:String(product.price),color:product.color,texture:product.texture,description:product.description??"",badge:product.badge??"",active:product.active!==false}:{...emptyProduct,section,category:availableCategories[0]?.name??""});
    const existing=await Promise.all((product?.media??[]).map(async media=>{const blob=await getProductMedia(media.id);return blob?{...media,url:URL.createObjectURL(blob)}:null}));
    const available=existing.filter((media):media is MediaDraft=>media!==null);setMediaDrafts(available);setCoverMediaId(product?.coverMediaId&&available.some(media=>media.id===product.coverMediaId)?product.coverMediaId:available[0]?.id??"");setRemovedMediaIds([]);setMediaError("");
    setProductModal(true);
  };
  const addMedia=(files:FileList|null)=>{if(!files)return;setMediaError("");const supported=Array.from(files).filter(file=>file.type.startsWith("image/")||file.type.startsWith("video/"));if(mediaDrafts.length+supported.length>8){setMediaError("You can add up to 8 images and videos per product.");return}const next=supported.map(file=>({id:makeAdminId("media"),name:file.name,type:(file.type.startsWith("video/")?"video":"image") as "video"|"image",url:URL.createObjectURL(file),file}));setMediaDrafts(current=>[...current,...next]);if(!coverMediaId&&next[0])setCoverMediaId(next[0].id)};
  const removeMedia=(media:MediaDraft)=>{URL.revokeObjectURL(media.url);const remaining=mediaDrafts.filter(item=>item.id!==media.id);setMediaDrafts(remaining);if(coverMediaId===media.id)setCoverMediaId(remaining[0]?.id??"");if(!media.file)setRemovedMediaIds(current=>[...current,media.id])};
  const closeProductModal=()=>{mediaDrafts.forEach(media=>URL.revokeObjectURL(media.url));setProductModal(false)};
  const saveProduct=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const orderedMedia=[...mediaDrafts].sort((a,b)=>a.id===coverMediaId?-1:b.id===coverMediaId?1:0);
    const value:Product={id:editingProduct??makeAdminId("product"),section:draft.section,name:draft.name.trim(),category:draft.category,price:Number(draft.price),color:draft.color,texture:draft.texture.trim()||"woven",description:draft.description.trim()||undefined,media:orderedMedia.map(({id,name,type})=>({id,name,type})),coverMediaId:coverMediaId||undefined,badge:draft.badge.trim()||undefined,active:draft.active};
    if(!value.name||!value.category||!Number.isFinite(value.price)||value.price<=0)return;
    try{await Promise.all(mediaDrafts.filter(media=>media.file).map(media=>saveProductMedia(media.id,media.file as File)));await Promise.all(removedMediaIds.map(deleteProductMedia));persistProducts(editingProduct?products.map(product=>product.id===editingProduct?value:product):[value,...products]);closeProductModal();flash(editingProduct?"Product updated successfully.":"Product created successfully.")}catch{setMediaError("The media could not be saved. Please try again.")}
  };
  const removeProduct=(product:Product)=>setDialog({title:"Delete product?",description:`${product.name} and its uploaded media will be permanently removed. This action cannot be undone.`,confirmLabel:"Delete product",tone:"danger",onConfirm:()=>{void Promise.all((product.media??[]).map(media=>deleteProductMedia(media.id)));persistProducts(products.filter(item=>item.id!==product.id));flash("Product deleted.")}});
  const toggleProduct=(id:string|undefined)=>{persistProducts(products.map(product=>product.id===id?{...product,active:product.active===false}:product));flash("Product status updated.")};
  const addCategory=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const name=categoryName.trim();if(!name||sectionCategories.some(category=>category.name.toLowerCase()===name.toLowerCase()))return;persistCategories([...categories,{id:makeAdminId("category"),section:catalogSection,name,note:categoryNote.trim(),active:true}]);setCategoryName("");setCategoryNote("");flash(`${catalogSection==="fabric"?"Fabric":"Accessory"} category created.`)};
  const toggleCategory=(id:string|undefined)=>{persistCategories(categories.map(category=>category.id===id?{...category,active:category.active===false}:category));flash("Category status updated.")};
  const removeCategory=(category:Category)=>{if(products.some(product=>product.category===category.name&&(product.section??"fabric")===(category.section??"fabric"))){setDialog({title:"Category is still in use",description:"Move or delete every product in this category before deleting the category.",confirmLabel:"Understood",cancelLabel:null});return}setDialog({title:"Delete category?",description:`${category.name} will be permanently removed. This action cannot be undone.`,confirmLabel:"Delete category",tone:"danger",onConfirm:()=>{persistCategories(categories.filter(item=>item.id!==category.id));flash("Category deleted.")}})};
  const resetCatalog=()=>setDialog({title:"Restore the original catalogue?",description:"All product and category changes made in this admin will be replaced by the original catalogue.",confirmLabel:"Restore catalogue",tone:"danger",onConfirm:()=>{persistProducts(defaultAdminProducts);persistCategories(defaultAdminCategories);flash("Original catalogue restored.")}});
  const saveSiteSettings=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();window.localStorage.setItem(SITE_SETTINGS_KEY,JSON.stringify(siteSettings));window.dispatchEvent(new Event("hsg-site-settings-updated"));flash("Website content updated.")};
  const updateHeroImage=async(file?:File)=>{if(!file||!file.type.startsWith("image/"))return;const id=siteSettings.heroImageId??"site-hero-image";await saveProductMedia(id,file);if(heroPreview)URL.revokeObjectURL(heroPreview);setHeroPreview(URL.createObjectURL(file));setSiteSettings(current=>({...current,heroImageId:id}))};

  if(!ready)return <main className="admin-loading">Loading admin…</main>;
  if(!authenticated)return <main className="admin-auth"><section className="admin-login-card"><Link href="/" className="admin-login-logo"><span className="brand-logo" aria-hidden="true"/></Link><p className="eyebrow">Store administration</p><h1>{hasAccount?"Welcome back":"Create your admin account"}</h1><p>{hasAccount?"Sign in to manage the Hisgrace Texture storefront.":"Set up the first administrator for this browser."}</p><form onSubmit={authenticate}><label>Email address<input name="email" type="email" required autoComplete="username" placeholder="admin@hisgracetexture.com"/></label><label>Password<input name="password" type="password" required minLength={8} autoComplete={hasAccount?"current-password":"new-password"} placeholder="At least 8 characters"/></label>{authError&&<div className="admin-auth-error" role="alert">{authError}</div>}<button type="submit">{hasAccount?"Sign in":"Create account and continue"} <ChevronRight size={17}/></button></form><Link href="/">← Return to storefront</Link></section></main>;

  const navigation:[AdminTab,string,React.ReactNode][]=[["dashboard","Overview",<LayoutDashboard key="d" size={18}/>],["products","Products",<Package key="p" size={18}/>],["categories","Categories",<FolderPlus key="c" size={18}/>],["settings","Settings",<Settings key="s" size={18}/>]];
  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-brand"><span className="brand-logo" aria-hidden="true"/><b>Admin</b></Link><nav>{navigation.map(([value,label,icon])=><button key={value} className={tab===value?"active":""} onClick={()=>setTab(value)}>{icon}{label}</button>)}</nav><div className="admin-sidebar-bottom"><Link href="/" target="_blank"><Eye size={17}/> View storefront</Link><button onClick={logout}><LogOut size={17}/> Sign out</button></div></aside><main className="admin-main"><header className="admin-topbar"><div><small>Hisgrace Texture</small><h1>{navigation.find(item=>item[0]===tab)?.[1]}</h1></div><span className="admin-avatar">A</span></header>{notice&&<div className="admin-notice" role="status"><Check size={17}/>{notice}</div>}
  {tab==="dashboard"&&<section className="admin-content"><div className="admin-welcome"><div><p className="eyebrow">Store overview</p><h2>Everything at a glance.</h2><p>Manage products, availability, and the collections customers see.</p></div><button onClick={()=>openProduct()}><Plus size={17}/> Add product</button></div><div className="admin-metrics"><article><span>Active products</span><b>{activeProducts.length}</b><small>{inactiveProducts} inactive</small></article><article><span>Categories</span><b>{activeCategories.length}</b><small>{categories.length-activeCategories.length} hidden</small></article><article><span>Catalogue value</span><b>{formatNaira(inventoryValue)}</b><small>One unit of every active item</small></article></div><div className="admin-panel"><div className="admin-panel-title"><div><h3>Recently managed products</h3><p>Quick access to your catalogue.</p></div><button onClick={()=>setTab("products")}>View all <ChevronRight size={15}/></button></div><ProductTable products={products.slice(0,6)} onPreview={setPreviewProduct} onEdit={openProduct} onToggle={toggleProduct} onDelete={removeProduct}/></div></section>}
  {tab==="products"&&<section className="admin-content"><SectionSwitch value={catalogSection} onChange={value=>{setCatalogSection(value);setSearch("")}} fabricCount={products.filter(product=>(product.section??"fabric")==="fabric").length} accessoriesCount={products.filter(product=>product.section==="accessories").length}/><div className="admin-page-actions"><div className="admin-search"><Search size={17}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={`Search ${catalogSection} products`}/></div><button onClick={()=>openProduct()}><Plus size={17}/> New {catalogSection==="fabric"?"fabric":"accessory"}</button></div><div className="admin-panel"><ProductTable products={filteredProducts} onPreview={setPreviewProduct} onEdit={openProduct} onToggle={toggleProduct} onDelete={removeProduct}/></div></section>}
  {tab==="categories"&&<section className="admin-content"><SectionSwitch value={catalogSection} onChange={setCatalogSection} fabricCount={categories.filter(category=>(category.section??"fabric")==="fabric").length} accessoriesCount={categories.filter(category=>category.section==="accessories").length}/><div className="admin-category-layout"><form className="admin-panel admin-category-form" onSubmit={addCategory}><p className="eyebrow">New {catalogSection==="fabric"?"fabric":"accessory"} collection</p><h3>Create category</h3><label>Category name<input value={categoryName} onChange={event=>setCategoryName(event.target.value)} required placeholder={catalogSection==="fabric"?"e.g. Italian Wool":"e.g. Watches"}/></label><label>Description<textarea value={categoryNote} onChange={event=>setCategoryNote(event.target.value)} rows={4} placeholder="A short customer-facing description"/></label><button><Plus size={17}/> Create category</button></form><div className="admin-panel"><div className="admin-panel-title"><div><h3>{catalogSection==="fabric"?"Fabric":"Accessory"} categories</h3><p>Show or hide collections across the storefront.</p></div></div><div className="admin-category-list">{sectionCategories.map(category=><article key={category.id}><div><span className={category.active===false?"status-dot off":"status-dot"}/><div><b>{category.name}</b><p>{category.note||"No description"}</p></div></div><div><button onClick={()=>toggleCategory(category.id)}>{category.active===false?<Eye size={16}/>:<EyeOff size={16}/>} {category.active===false?"Activate":"Deactivate"}</button><button className="danger" onClick={()=>removeCategory(category)} aria-label={`Delete ${category.name}`}><Trash2 size={16}/></button></div></article>)}</div></div></div></section>}
  {tab==="settings"&&<section className="admin-content"><form className="admin-panel admin-site-editor" onSubmit={saveSiteSettings}><div className="admin-panel-title"><div><p className="eyebrow">Landing page</p><h2>Announcement & hero</h2><p>Update the content customers see first.</p></div><button type="submit">Save website changes</button></div><label className="wide">Announcement bar<input value={siteSettings.announcement} onChange={event=>setSiteSettings({...siteSettings,announcement:event.target.value})}/></label><div className="admin-site-grid"><label>Hero eyebrow<input value={siteSettings.heroEyebrow} onChange={event=>setSiteSettings({...siteSettings,heroEyebrow:event.target.value})}/></label><label>Main heading<input value={siteSettings.heroTitle} onChange={event=>setSiteSettings({...siteSettings,heroTitle:event.target.value})}/></label><label>Highlighted heading<input value={siteSettings.heroAccent} onChange={event=>setSiteSettings({...siteSettings,heroAccent:event.target.value})}/></label><label>Image caption<input value={siteSettings.imageNote} onChange={event=>setSiteSettings({...siteSettings,imageNote:event.target.value})}/></label><label className="wide">Supporting text<textarea rows={3} value={siteSettings.heroDescription} onChange={event=>setSiteSettings({...siteSettings,heroDescription:event.target.value})}/></label><label>Primary button label<input value={siteSettings.primaryLabel} onChange={event=>setSiteSettings({...siteSettings,primaryLabel:event.target.value})}/></label><label>Primary button link<input value={siteSettings.primaryHref} onChange={event=>setSiteSettings({...siteSettings,primaryHref:event.target.value})}/></label><label>Secondary button label<input value={siteSettings.secondaryLabel} onChange={event=>setSiteSettings({...siteSettings,secondaryLabel:event.target.value})}/></label><label>Secondary button link<input value={siteSettings.secondaryHref} onChange={event=>setSiteSettings({...siteSettings,secondaryHref:event.target.value})}/></label><label>First trust message<input value={siteSettings.trustOne} onChange={event=>setSiteSettings({...siteSettings,trustOne:event.target.value})}/></label><label>Second trust message<input value={siteSettings.trustTwo} onChange={event=>setSiteSettings({...siteSettings,trustTwo:event.target.value})}/></label></div><div className="admin-hero-upload"><div className="admin-hero-preview" style={heroPreview?{backgroundImage:`url(${heroPreview})`}:undefined}/><div><b>Hero image</b><p>Use a wide, high-quality image. JPG, PNG and WebP are supported.</p><label><ImagePlus size={17}/> Replace hero image<input type="file" accept="image/*" onChange={event=>{void updateHeroImage(event.target.files?.[0]);event.target.value=""}}/></label></div></div></form><div className="admin-panel admin-settings admin-maintenance"><p className="eyebrow">Administration</p><h2>Store settings</h2><div className="admin-setting-row"><div><b>Storefront data</b><p>Restore the original product and category catalogue.</p></div><button className="danger-outline" onClick={resetCatalog}>Restore defaults</button></div><div className="admin-setting-row"><div><b>Admin session</b><p>Sign out of the dashboard on this device.</p></div><button onClick={logout}>Sign out</button></div><div className="admin-security-note"><b>Deployment note</b><p>This immediate version stores admin data in this browser. Before inviting multiple staff or managing live inventory across devices, connect the isolated catalogue layer to D1 and server-side authentication.</p></div></div></section>}
  {previewProduct&&<AdminProductPreview product={previewProduct} onClose={()=>setPreviewProduct(null)} onEdit={()=>{const product=previewProduct;setPreviewProduct(null);void openProduct(product)}}/>}
  </main>{productModal&&<div className="admin-modal-backdrop" onClick={closeProductModal}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={event=>event.stopPropagation()}><button className="admin-modal-close" onClick={closeProductModal} aria-label="Close"><X/></button><p className="eyebrow">{draft.section==="fabric"?"Fabric":"Accessories"} catalogue</p><h2 id="product-modal-title">{editingProduct?"Edit product":"Create product"}</h2><form onSubmit={saveProduct}><label>Major section<select value={draft.section} onChange={event=>{const section=event.target.value as CatalogSection;const first=categories.find(category=>(category.section??"fabric")===section&&category.active!==false);setDraft({...draft,section,category:first?.name??""})}}><option value="fabric">Fabric</option><option value="accessories">Accessories</option></select></label><label>Category<select required value={draft.category} onChange={event=>setDraft({...draft,category:event.target.value})}><option value="">Select category</option>{categories.filter(category=>(category.section??"fabric")===draft.section&&category.active!==false).map(category=><option key={category.id} value={category.name}>{category.name}</option>)}</select></label><label className="wide">Product name<input required value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} placeholder="Product name"/></label><label>Price (₦)<input required type="number" min="1" value={draft.price} onChange={event=>setDraft({...draft,price:event.target.value})}/></label><label>Colour<input type="color" value={draft.color} onChange={event=>setDraft({...draft,color:event.target.value})}/></label><label>Texture style<input value={draft.texture} onChange={event=>setDraft({...draft,texture:event.target.value})} placeholder={draft.section==="fabric"?"woven":"fragrance"}/></label><label>Badge<input value={draft.badge} onChange={event=>setDraft({...draft,badge:event.target.value})} placeholder="New, Bestseller, Limited…"/></label><label className="wide">Description<input value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})} placeholder="Short product description"/></label><div className="admin-media-field wide"><div><b>Product media</b><span>{mediaDrafts.length}/8 items</span></div><label className="admin-media-upload"><ImagePlus size={22}/><strong>Add pictures or videos</strong><small>Choose up to 8 items in total</small><input type="file" accept="image/*,video/*" multiple onChange={event=>{addMedia(event.target.files);event.target.value=""}} disabled={mediaDrafts.length>=8}/></label>{mediaError&&<p className="admin-media-error" role="alert">{mediaError}</p>}{mediaDrafts.length>0&&<div className="admin-media-grid">{mediaDrafts.map((media,index)=><article key={media.id}>{media.type==="video"?<video src={media.url} muted playsInline/>:<img src={media.url} alt=""/>}<span>{index+1}</span><button type="button" onClick={()=>removeMedia(media)} aria-label={`Remove ${media.name}`}><X size={15}/></button><small>{media.type}</small></article>)}</div>}</div><label className="admin-check wide"><input type="checkbox" checked={draft.active} onChange={event=>setDraft({...draft,active:event.target.checked})}/> Active and visible on storefront</label><div className="admin-modal-actions wide"><button type="button" onClick={closeProductModal}>Cancel</button><button type="submit">{editingProduct?"Save changes":"Create product"}</button></div></form></section></div>}<AppDialog open={Boolean(dialog)} title={dialog?.title??""} description={dialog?.description??""} confirmLabel={dialog?.confirmLabel} cancelLabel={dialog?.cancelLabel} tone={dialog?.tone} onConfirm={dialog?.onConfirm} onClose={()=>setDialog(null)}/></div>;
}

function SectionSwitch({value,onChange,fabricCount,accessoriesCount}:{value:CatalogSection;onChange:(value:CatalogSection)=>void;fabricCount:number;accessoriesCount:number}){
  return <div className="admin-section-switch" aria-label="Catalogue section"><button className={value==="fabric"?"active":""} onClick={()=>onChange("fabric")}><span>Fabric</span><b>{fabricCount}</b></button><button className={value==="accessories"?"active":""} onClick={()=>onChange("accessories")}><span>Accessories</span><b>{accessoriesCount}</b></button></div>;
}

function ProductTable({products,onPreview,onEdit,onToggle,onDelete}:{products:Product[];onPreview:(product:Product)=>void;onEdit:(product:Product)=>void;onToggle:(id:string|undefined)=>void;onDelete:(product:Product)=>void}){
  if(!products.length)return <div className="admin-empty"><Package size={30}/><b>No products found</b><p>Try another search or create a product.</p></div>;
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{products.map(product=><tr key={product.id}><td><span className={`admin-product-swatch ${product.texture}`} style={{"--swatch":product.color} as React.CSSProperties}/><div><b>{product.name}</b><small>{product.badge||"Standard"}</small></div></td><td>{product.category}</td><td>{formatNaira(product.price)}</td><td><span className={product.active===false?"admin-status inactive":"admin-status"}>{product.active===false?"Inactive":"Active"}</span></td><td><button onClick={()=>onPreview(product)} aria-label={`Preview ${product.name}`}><Monitor size={16}/></button><button onClick={()=>onEdit(product)} aria-label={`Edit ${product.name}`}><Edit3 size={16}/></button><button onClick={()=>onToggle(product.id)} aria-label={`${product.active===false?"Activate":"Deactivate"} ${product.name}`}>{product.active===false?<Eye size={16}/>:<EyeOff size={16}/>}</button><button className="danger" onClick={()=>onDelete(product)} aria-label={`Delete ${product.name}`}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>;
}
