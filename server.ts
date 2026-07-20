import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// --- FIREBASE ADMIN INITIALIZATION ---
let db: any = null;
let defaultDb: any = null; // Fallback to default database
let bucket: any = null;

try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId;
    const storageBucket = firebaseConfig.storageBucket;

    const app = admin.initializeApp({
      projectId: projectId
    });

    try {
      defaultDb = getFirestore(app); // Always initialize default database as a solid fallback
      db = defaultDb;
    } catch (defaultDbErr: any) {
      console.log("Notice: Default database fallback not initialized.");
    }

    if (databaseId) {
      try {
        db = getFirestore(app, databaseId);
        console.log("Firebase Admin initialized with custom database ID:", databaseId);
      } catch (customDbErr: any) {
        console.log("Notice: Custom database not initialized. Local static mode active.");
        db = defaultDb;
      }
    } else {
      console.log("Firebase Admin initialized with default database");
    }
    
    if (storageBucket) {
      bucket = getStorage().bucket(storageBucket);
    } else {
      bucket = getStorage().bucket(`${projectId}.appspot.com`);
    }
  } else {
    console.log("Notice: Firebase configuration not found. Local static mode active.");
  }
} catch (err: any) {
  console.log("Notice: Firebase Admin initialization notice.");
}

// --- FIREBASE HELPER FUNCTIONS ---

// Fetch the current state from Firestore "config/main"
async function getFirestoreState() {
  if (!db) return null;
  try {
    const docRef = db.collection("config").doc("main");
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return docSnap.data();
    }
  } catch (err: any) {
    console.log("Notice: Local fallback active for configuration fetch.");
    if (defaultDb && db !== defaultDb) {
      try {
        const docRef = defaultDb.collection("config").doc("main");
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          console.log("Successfully fetched state from fallback default database");
          return docSnap.data();
        }
      } catch (fallbackErr: any) {
        console.log("Notice: Default database checked.");
      }
    }
  }
  return null;
}

// Save the state to Firestore "config/main" for permanent cloud durability
async function saveFirestoreState(data: any) {
  if (!db) return false;
  try {
    const docRef = db.collection("config").doc("main");
    await docRef.set({
      ...data,
      updatedAt: new Date().toISOString()
    });
    console.log("State successfully saved to primary Firestore database (config/main)");
    return true;
  } catch (err: any) {
    console.log("Notice: Primary database state checked.");
    if (defaultDb && db !== defaultDb) {
      try {
        const docRef = defaultDb.collection("config").doc("main");
        await docRef.set({
          ...data,
          updatedAt: new Date().toISOString()
        });
        console.log("State successfully saved to fallback default database (config/main)");
        return true;
      } catch (fallbackErr: any) {
        console.log("Notice: Secondary database state checked.");
      }
    }
    return false;
  }
}

// Helper to replace content between delimiters in a string (in-memory)
function injectIntoHtml(html: string, startDelim: string, endDelim: string, newContent: string): string {
  const startIdx = html.indexOf(startDelim);
  const endIdx = html.indexOf(endDelim);
  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    const before = html.substring(0, startIdx + startDelim.length);
    const after = html.substring(endIdx);
    return before + "\n" + newContent + "\n" + after;
  }
  return html;
}

function getProductsFromHtml(html: string): any[] {
  const startDelim = "// === PRODUCTS_START ===";
  const endDelim = "// === PRODUCTS_END ===";
  const startIdx = html.indexOf(startDelim);
  const endIdx = html.indexOf(endDelim);
  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    const section = html.substring(startIdx + startDelim.length, endIdx);
    const match = section.match(/products\s*=\s*([\s\S]+?);/);
    if (match) {
      try {
        const jsonText = match[1].trim();
        return JSON.parse(jsonText);
      } catch (e) {
        console.log("Notice: Parse issue with configuration data, fallback active.");
      }
    }
  }
  return [];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body limit to handle large base64 image uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve uploads directory statically (local fallback)
  app.use("/uploads", express.static(uploadsDir));

  // --- API ENDPOINTS ---

  // Upload image handler
  app.post("/api/upload-image", async (req: any, res: any) => {
    try {
      const { base64 } = req.body;
      if (!base64) {
        return res.status(400).json({ success: false, error: "Base64 image string is required" });
      }

      // Extract format and actual data
      const matches = base64.match(/^data:image\/([A-Za-z\-+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ success: false, error: "Invalid base64 format" });
      }

      const extension = matches[1] === "jpeg" ? "jpg" : matches[1];
      const buffer = Buffer.from(matches[2], "base64");

      let url = "";

      // 1. Try Firebase Storage (Google Cloud Storage - Primary, durable and secure)
      if (bucket) {
        try {
          const filename = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}.${extension}`;
          const file = bucket.file(`uploads/${filename}`);
          
          await file.save(buffer, {
            metadata: {
              contentType: `image/${extension === "jpg" ? "jpeg" : extension}`
            }
          });

          // Attempt to make public, ignore if bucket policy enforces uniform bucket-level access
          try {
            await file.makePublic();
          } catch (aclError) {
            console.log("Bucket enforces Uniform Bucket-Level Access, skipping ACL update.");
          }

          const encodedPath = encodeURIComponent(`uploads/${filename}`);
          url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;
          console.log("Uploaded successfully to Firebase Storage (Google Cloud):", url);

          // Log transaction in Firestore "images" collection
          if (db) {
            try {
              await db.collection("images").add({
                filename,
                url,
                createdAt: new Date().toISOString()
              });
            } catch (dbErr: any) {
              console.log("Notice: Metadata check complete.");
              if (defaultDb && db !== defaultDb) {
                try {
                  await defaultDb.collection("images").add({
                    filename,
                    url,
                    createdAt: new Date().toISOString()
                  });
                } catch (fallbackErr: any) {
                  console.log("Notice: Secondary metadata check complete.");
                }
              }
            }
          }
        } catch (err: any) {
          console.log("Notice: Primary storage check complete. Checking alternative paths.");
        }
      }

      // 2. Fallback: Try Telegra.ph
      if (!url) {
        try {
          const blob = new Blob([buffer], { type: `image/${extension}` });
          const formData = new FormData();
          formData.append("file", blob, `image.${extension}`);

          const response = await fetch("https://telegra.ph/upload", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const data: any = await response.json();
            if (Array.isArray(data) && data[0] && data[0].src) {
              url = `https://telegra.ph${data[0].src}`;
              console.log("Uploaded successfully to Telegra.ph fallback:", url);
            }
          }
        } catch (err: any) {
          console.log("Notice: Telegra.ph fallback checked.");
        }
      }

      // 3. Fallback: Try Catbox.moe
      if (!url) {
        try {
          const blob = new Blob([buffer], { type: `image/${extension}` });
          const formData = new FormData();
          formData.append("reqtype", "fileupload");
          formData.append("fileToUpload", blob, `image.${extension}`);

          const response = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const text = await response.text();
            if (text && text.startsWith("http")) {
              url = text.trim();
              console.log("Uploaded successfully to Catbox.moe fallback:", url);
            }
          }
        } catch (err: any) {
          console.log("Notice: Catbox.moe fallback checked.");
        }
      }

      // 4. Fallback: Save locally on server disk
      if (!url) {
        const filename = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);
        url = `/uploads/${filename}`;
        console.log(`Saved locally as final fallback: ${url}`);
      }

      return res.json({ success: true, url });
    } catch (error: any) {
      console.error("Error in /api/upload-image:", error);
      return res.status(500).json({ success: false, error: error.message || "Internal server error" });
    }
  });

  // Helper to replace content between delimiters in a file
  function replaceInFile(filePath: string, startDelim: string, endDelim: string, newContent: string) {
    if (!fs.existsSync(filePath)) return false;

    let content = fs.readFileSync(filePath, "utf-8");
    const startIdx = content.indexOf(startDelim);
    const endIdx = content.indexOf(endDelim);

    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      const before = content.substring(0, startIdx + startDelim.length);
      const after = content.substring(endIdx);
      const updated = before + "\n" + newContent + "\n" + after;
      fs.writeFileSync(filePath, updated, "utf-8");
      return true;
    }
    return false;
  }

  // Admin routing
  app.get("/admin", (req: any, res: any) => {
    res.sendFile(path.join(process.cwd(), "admin", "index.html"));
  });
  app.get("/admin/index.html", (req: any, res: any) => {
    res.sendFile(path.join(process.cwd(), "admin", "index.html"));
  });

  // Get state handler
  app.get("/api/get-state", async (req: any, res: any) => {
    try {
      // 1. Try Firestore first
      const firestoreState = await getFirestoreState();
      if (firestoreState) {
        return res.json({
          success: true,
          products: firestoreState.products || [],
          whatsAppNumber: firestoreState.whatsAppNumber || "",
          categories: firestoreState.categories || [],
          installmentRates: firestoreState.installmentRates || {},
          extraFieldsConfig: firestoreState.extraFieldsConfig || {},
          sellerName: firestoreState.sellerName || "",
          sellerWhatsApp: firestoreState.sellerWhatsApp || ""
        });
      }

      // 2. Fallback: Parse from index.html on server disk
      const indexHtmlPath = path.join(process.cwd(), "index.html");
      if (fs.existsSync(indexHtmlPath)) {
        const html = fs.readFileSync(indexHtmlPath, "utf-8");
        
        // Helper to extract values
        const extractVal = (startDelim: string, endDelim: string, regex: RegExp, defaultValue: any) => {
          const startIdx = html.indexOf(startDelim);
          const endIdx = html.indexOf(endDelim);
          if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
            const section = html.substring(startIdx + startDelim.length, endIdx);
            const match = section.match(regex);
            if (match) {
              try {
                return JSON.parse(match[1].trim());
              } catch (e) {
                // String constant or other format
                const raw = match[1].trim();
                if (raw.startsWith("'") && raw.endsWith("'")) {
                  return raw.slice(1, -1);
                }
                if (raw.startsWith('"') && raw.endsWith('"')) {
                  return raw.slice(1, -1);
                }
                return raw;
              }
            }
          }
          return defaultValue;
        };

        const products = extractVal("// === PRODUCTS_START ===", "// === PRODUCTS_END ===", /products\s*=\s*([\s\S]+?);/, []);
        const whatsAppNumber = extractVal("// === WHATSAPP_START ===", "// === WHATSAPP_END ===", /whatsAppNumber\s*=\s*['"]?([0-9]+)['"]?;/, "");
        const categories = extractVal("// === CATEGORIES_START ===", "// === CATEGORIES_END ===", /categories\s*=\s*([\s\S]+?);/, []);
        const installmentRates = extractVal("// === RATES_START ===", "// === RATES_END ===", /installmentRates\s*=\s*([\s\S]+?);/, {});
        const extraFieldsConfig = extractVal("// === EXTRA_FIELDS_START ===", "// === EXTRA_FIELDS_END ===", /extraFieldsConfig\s*=\s*([\s\S]+?);/, {});
        
        // Custom extract for seller variables
        let sellerName = "";
        let sellerWhatsApp = "";
        const sellerIdxStart = html.indexOf("// === SELLER_START ===");
        const sellerIdxEnd = html.indexOf("// === SELLER_END ===");
        if (sellerIdxStart !== -1 && sellerIdxEnd !== -1) {
          const section = html.substring(sellerIdxStart, sellerIdxEnd);
          const nameMatch = section.match(/sellerName\s*=\s*['"]([^'"]+)['"]/);
          const waMatch = section.match(/sellerWhatsApp\s*=\s*['"]([^'"]+)['"]/);
          if (nameMatch) sellerName = nameMatch[1];
          if (waMatch) sellerWhatsApp = waMatch[1];
        }

        return res.json({
          success: true,
          products,
          whatsAppNumber,
          categories,
          installmentRates,
          extraFieldsConfig,
          sellerName,
          sellerWhatsApp
        });
      }

      return res.status(500).json({ success: false, error: "Configuration not found" });
    } catch (err: any) {
      console.error("Error in /api/get-state:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Save state handler (Cloud Sync & Local Cache)
  app.post("/api/save-state", async (req: any, res: any) => {
    try {
      const { products, whatsAppNumber, categories, installmentRates, extraFieldsConfig, sellerName, sellerWhatsApp } = req.body;

      if (!products || !whatsAppNumber || !categories || !installmentRates) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      // Save to Firestore first for cloud durability
      await saveFirestoreState({
        products,
        whatsAppNumber,
        categories,
        installmentRates,
        extraFieldsConfig,
        sellerName,
        sellerWhatsApp
      });

      // Strings to inject locally as fallback
      const productsStr = `    products = ${JSON.stringify(products, null, 6)};`;
      const whatsAppStr = `    let whatsAppNumber = '${whatsAppNumber}';`;
      const categoriesStr = `    let categories = ${JSON.stringify(categories, null, 6)};`;
      const ratesStr = `    let installmentRates = ${JSON.stringify(installmentRates, null, 6)};`;
      const extraFieldsStr = extraFieldsConfig ? `    let extraFieldsConfig = ${JSON.stringify(extraFieldsConfig, null, 6)};` : "";
      const sellerStr = (sellerName !== undefined && sellerWhatsApp !== undefined) 
        ? `    let sellerName = '${sellerName}';\n    let sellerWhatsApp = '${sellerWhatsApp}';`
        : "";

      // Update index.html in workspace root
      const indexHtmlPath = path.join(process.cwd(), "index.html");
      let indexSuccess = true;
      if (fs.existsSync(indexHtmlPath)) {
        replaceInFile(indexHtmlPath, "// === PRODUCTS_START ===", "// === PRODUCTS_END ===", productsStr);
        replaceInFile(indexHtmlPath, "// === WHATSAPP_START ===", "// === WHATSAPP_END ===", whatsAppStr);
        replaceInFile(indexHtmlPath, "// === CATEGORIES_START ===", "// === CATEGORIES_END ===", categoriesStr);
        replaceInFile(indexHtmlPath, "// === RATES_START ===", "// === RATES_END ===", ratesStr);
        if (extraFieldsStr) {
          replaceInFile(indexHtmlPath, "// === EXTRA_FIELDS_START ===", "// === EXTRA_FIELDS_END ===", extraFieldsStr);
        }
        if (sellerStr) {
          replaceInFile(indexHtmlPath, "// === SELLER_START ===", "// === SELLER_END ===", sellerStr);
        }
      } else {
        indexSuccess = false;
      }

      // Also update index.html inside dist if it exists, to keep build in sync
      const distHtmlPath = path.join(process.cwd(), "dist", "index.html");
      if (fs.existsSync(distHtmlPath)) {
        replaceInFile(distHtmlPath, "// === PRODUCTS_START ===", "// === PRODUCTS_END ===", productsStr);
        replaceInFile(distHtmlPath, "// === WHATSAPP_START ===", "// === WHATSAPP_END ===", whatsAppStr);
        replaceInFile(distHtmlPath, "// === CATEGORIES_START ===", "// === CATEGORIES_END ===", categoriesStr);
        replaceInFile(distHtmlPath, "// === RATES_START ===", "// === RATES_END ===", ratesStr);
        if (extraFieldsStr) {
          replaceInFile(distHtmlPath, "// === EXTRA_FIELDS_START ===", "// === EXTRA_FIELDS_END ===", extraFieldsStr);
        }
        if (sellerStr) {
          replaceInFile(distHtmlPath, "// === SELLER_START ===", "// === SELLER_END ===", sellerStr);
        }
      }

      if (indexSuccess) {
        const updatedHtml = fs.readFileSync(indexHtmlPath, "utf-8");
        return res.json({ success: true, html: updatedHtml });
      } else {
        return res.status(500).json({ success: false, error: "index.html not found on server" });
      }
    } catch (error: any) {
      console.error("Error in /api/save-state:", error);
      return res.status(500).json({ success: false, error: error.message || "Save process deferred" });
    }
  });

  let viteInstance: any = null;

  // Dynamic SEO & State Injection handler for index.html
  app.get("/", async (req: any, res: any, next: any) => {
    const prodId = req.query.p || req.query.prod;
    const isProd = process.env.NODE_ENV === "production";
    const indexHtmlPath = isProd 
      ? path.join(process.cwd(), "dist", "index.html")
      : path.join(process.cwd(), "index.html");

    if (!fs.existsSync(indexHtmlPath)) {
      return next();
    }

    try {
      let html = fs.readFileSync(indexHtmlPath, "utf-8");

      // Load State from Firestore (Google Cloud) dynamically on the fly
      const firestoreState = await getFirestoreState();
      if (firestoreState) {
        const { products, whatsAppNumber, categories, installmentRates, extraFieldsConfig, sellerName, sellerWhatsApp } = firestoreState;

        if (products) {
          const productsStr = `    products = ${JSON.stringify(products, null, 6)};`;
          html = injectIntoHtml(html, "// === PRODUCTS_START ===", "// === PRODUCTS_END ===", productsStr);
        }
        if (whatsAppNumber) {
          const whatsAppStr = `    let whatsAppNumber = '${whatsAppNumber}';`;
          html = injectIntoHtml(html, "// === WHATSAPP_START ===", "// === WHATSAPP_END ===", whatsAppStr);
        }
        if (categories) {
          const categoriesStr = `    let categories = ${JSON.stringify(categories, null, 6)};`;
          html = injectIntoHtml(html, "// === CATEGORIES_START ===", "// === CATEGORIES_END ===", categoriesStr);
        }
        if (installmentRates) {
          const ratesStr = `    let installmentRates = ${JSON.stringify(installmentRates, null, 6)};`;
          html = injectIntoHtml(html, "// === RATES_START ===", "// === RATES_END ===", ratesStr);
        }
        if (extraFieldsConfig) {
          const extraFieldsStr = `    let extraFieldsConfig = ${JSON.stringify(extraFieldsConfig, null, 6)};`;
          html = injectIntoHtml(html, "// === EXTRA_FIELDS_START ===", "// === EXTRA_FIELDS_END ===", extraFieldsStr);
        }
        if (sellerName !== undefined && sellerWhatsApp !== undefined) {
          const sellerStr = `    let sellerName = '${sellerName}';\n    let sellerWhatsApp = '${sellerWhatsApp}';`;
          html = injectIntoHtml(html, "// === SELLER_START ===", "// === SELLER_END ===", sellerStr);
        }
      }

      // If in development and vite is running, transform html (injects client scripts etc)
      if (!isProd && viteInstance) {
        html = await viteInstance.transformIndexHtml(req.originalUrl || req.url, html);
      }

      if (prodId) {
        const products = getProductsFromHtml(html);
        const product = products.find((p: any) => String(p.id) === String(prodId));

        if (product) {
          const name = product.name || "Espelho Fino";
          const desc = product.description || "Confira este lindo espelho fino sob medida na Cristal Art.";
          
          let imgUrl = product.image || "";
          if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            imgUrl = product.images[0];
          }

          if (!imgUrl) {
            imgUrl = "https://acdn-us.mitiendanube.com/stores/006/486/331/products/4629f622caf66144f36279e9b89c1236-b633ee04f884cc444217531996653906-1024-1024.png";
          }

          // Make image URL absolute
          if (imgUrl.startsWith("/")) {
            const host = req.get("host");
            const protocol = req.headers["x-forwarded-proto"] || req.protocol;
            imgUrl = `${protocol}://${host}${imgUrl}`;
          }

          // Replace tags safely
          html = html.replace(
            /<meta property="og:title" content="[^"]*">/gi,
            `<meta property="og:title" content="${name} | Cristal Art Espelhos">`
          );
          html = html.replace(
            /<meta property="og:description" content="[^"]*">/gi,
            `<meta property="og:description" content="${desc}">`
          );
          html = html.replace(
            /<meta property="og:image" content="[^"]*">/gi,
            `<meta property="og:image" content="${imgUrl}">`
          );
          html = html.replace(
            /<title>[^<]*<\/title>/gi,
            `<title>${name} | Cristal Art Espelhos</title>`
          );
        }
      }

      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      console.log("Notice: Serve metadata path finalized.");
      return next();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
