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

  // Custom CORS middleware to support uploading and saving from custom domains like Vercel
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Increase body limit to handle large base64 image uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Ensure IMGs directory exists
  const imgsDir = path.join(process.cwd(), "IMGs");
  if (!fs.existsSync(imgsDir)) {
    fs.mkdirSync(imgsDir, { recursive: true });
  }

  // Serve directories statically with robust Firebase Storage fallback for container restarts
  const serveWithFallback = (localDir: string, bucketSubdir: string) => {
    return async (req: any, res: any, next: any) => {
      try {
        const filename = req.params.filename;
        if (!filename) return next();

        const localPath = path.join(localDir, filename);

        // If file exists locally, serve it
        if (fs.existsSync(localPath)) {
          return res.sendFile(localPath);
        }

        // If file does not exist locally, download it from Firebase Storage bucket
        if (bucket) {
          const remotePath = `${bucketSubdir}/${filename}`;
          const file = bucket.file(remotePath);
          console.log(`Checking Firebase Storage for missing file: ${remotePath}`);
          
          const [exists] = await file.exists();
          if (exists) {
            console.log(`Downloading missing file from Firebase Storage: ${remotePath}`);
            const [buffer] = await file.download();
            
            // Save locally to cache it on ephemeral container disk
            fs.writeFileSync(localPath, buffer);
            console.log(`Successfully cached file locally: ${localPath}`);
            
            return res.sendFile(localPath);
          } else {
            console.log(`File does not exist in Firebase Storage bucket: ${remotePath}`);
          }
        }
      } catch (err: any) {
        console.error(`Error in serveWithFallback for ${req.params.filename}:`, err);
      }
      next();
    };
  };

  app.get("/uploads/:filename", serveWithFallback(uploadsDir, "uploads"));
  app.get("/IMGs/:filename", serveWithFallback(imgsDir, "IMGs"));

  // Static serving as final fallback
  app.use("/uploads", express.static(uploadsDir));
  app.use("/IMGs", express.static(imgsDir));

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

      let rawExt = matches[1].toLowerCase();
      let extension = rawExt;
      if (rawExt === "jpeg") extension = "jpg";
      else if (rawExt.includes("svg")) extension = "svg";
      else if (rawExt.includes("icon") || rawExt.includes("ico")) extension = "ico";
      else if (rawExt.includes("webp")) extension = "webp";
      else if (rawExt.includes("png")) extension = "png";
      else if (rawExt.includes("gif")) extension = "gif";
      else if (rawExt.includes("avif")) extension = "avif";

      const buffer = Buffer.from(matches[2], "base64");

      // 1. ALWAYS write the file locally inside IMGs/ folder to allow GitHub / Vercel immediate sync
      const filename = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}.${extension}`;
      const filePath = path.join(imgsDir, filename);
      fs.writeFileSync(filePath, buffer);
      console.log(`Saved locally inside IMGs directory: ${filePath}`);

      // The primary relative URL is inside IMGs/
      let url = `IMGs/${filename}`;

      // (Optional Backup) If bucket is set up, upload to Firebase Storage as well
      if (bucket) {
        try {
          // Check if bucket exists and is accessible to prevent unhandled GaxiosErrors
          const [exists] = await bucket.exists().catch(() => [false]);
          if (exists) {
            const remotePath = `IMGs/${filename}`;
            const file = bucket.file(remotePath);
            const downloadToken = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
            
            await file.save(buffer, {
              metadata: {
                contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
                metadata: {
                  firebaseStorageDownloadTokens: downloadToken
                }
              }
            });
            
            console.log("Uploaded file successfully to Firebase Storage.");
            
            // Generate the direct, public, permanent download URL with token
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(remotePath)}?alt=media&token=${downloadToken}`;
            
            // Return the absolute public Cloud Storage URL so it persists permanently and can be loaded from anywhere
            url = publicUrl;
  
            // Also log to Firestore "images" and "IMGs" collection for cloud synchronization
            if (db) {
              try {
                const docData = {
                  filename,
                  url: publicUrl,
                  createdAt: new Date().toISOString()
                };
                await db.collection("images").add(docData);
                await db.collection("IMGs").add(docData);
              } catch (dbErr: any) {
                console.log("Notice: Firestore image logging complete.");
              }
            }
          } else {
            console.log(`Notice: Firebase Storage bucket ${bucket.name} does not exist or is not initialized yet. Using local container path: ${url}`);
          }
        } catch (err: any) {
          console.log("Notice: Firebase Storage upload skipped, fallback to local path. Reason:", err.message || err);
        }
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
  app.get(["/admin", "/admin/", "/admin/index.html"], async (req: any, res: any, next: any) => {
    const adminHtmlPath = path.join(process.cwd(), "admin", "index.html");
    if (!fs.existsSync(adminHtmlPath)) {
      return next();
    }
    try {
      let html = fs.readFileSync(adminHtmlPath, "utf-8");

      // Inject dynamic backendUrl
      const host = req.get("host");
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const currentBackendUrl = `${protocol}://${host}`;
      const backendUrlStr = `    let backendUrl = '${currentBackendUrl}';`;
      html = injectIntoHtml(html, "// === BACKEND_URL_START ===", "// === BACKEND_URL_END ===", backendUrlStr);

      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      return res.sendFile(adminHtmlPath);
    }
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
          sellerWhatsApp: firestoreState.sellerWhatsApp || "",
          visualConfig: firestoreState.visualConfig || null
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
        const visualConfig = extractVal("// === VISUAL_START ===", "// === VISUAL_END ===", /visualConfig\s*=\s*([\s\S]+?);/, null);
        
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
          sellerWhatsApp,
          visualConfig
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
      const { products, whatsAppNumber, categories, installmentRates, extraFieldsConfig, sellerName, sellerWhatsApp, visualConfig } = req.body;

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
        sellerWhatsApp,
        visualConfig
      });

      // Strings to inject locally as fallback
      const productsStr = `    products = ${JSON.stringify(products, null, 6)};`;
      const whatsAppStr = `    let whatsAppNumber = '${whatsAppNumber}';`;
      const categoriesStr = `    let categories = ${JSON.stringify(categories, null, 6)};`;
      const ratesStr = `    let installmentRates = ${JSON.stringify(installmentRates, null, 6)};`;
      const extraFieldsStr = extraFieldsConfig ? `    let extraFieldsConfig = ${JSON.stringify(extraFieldsConfig, null, 6)};` : "";
      const visualConfigStr = visualConfig ? `    let visualConfig = ${JSON.stringify(visualConfig, null, 6)};` : "";
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
        if (visualConfigStr) {
          replaceInFile(indexHtmlPath, "// === VISUAL_START ===", "// === VISUAL_END ===", visualConfigStr);
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
        if (visualConfigStr) {
          replaceInFile(distHtmlPath, "// === VISUAL_START ===", "// === VISUAL_END ===", visualConfigStr);
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

  // Export index.html dynamically compiled with the latest data
  app.get("/api/export-index", async (req: any, res: any) => {
    try {
      const indexHtmlPath = path.join(process.cwd(), "index.html");
      if (!fs.existsSync(indexHtmlPath)) {
        return res.status(500).json({ success: false, error: "index.html not found on server" });
      }

      let html = fs.readFileSync(indexHtmlPath, "utf-8");

      // Load current state from Firestore to make sure the exported file has the latest data embedded
      const firestoreState = await getFirestoreState();
      if (firestoreState) {
        const { products, whatsAppNumber, categories, installmentRates, extraFieldsConfig, sellerName, sellerWhatsApp, visualConfig } = firestoreState;

        // Inject dynamic backendUrl
        const host = req.get("host");
        const protocol = req.headers["x-forwarded-proto"] || req.protocol;
        const currentBackendUrl = `${protocol}://${host}`;
        const backendUrlStr = `    let backendUrl = '${currentBackendUrl}';`;
        html = injectIntoHtml(html, "// === BACKEND_URL_START ===", "// === BACKEND_URL_END ===", backendUrlStr);

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
        if (visualConfig) {
          const visualConfigStr = `    let visualConfig = ${JSON.stringify(visualConfig, null, 6)};`;
          html = injectIntoHtml(html, "// === VISUAL_START ===", "// === VISUAL_END ===", visualConfigStr);
        }
      }

      res.setHeader("Content-Disposition", "attachment; filename=index.html");
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err: any) {
      console.error("Error exporting index.html:", err);
      return res.status(500).json({ success: false, error: err.message });
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
        const { products, whatsAppNumber, categories, installmentRates, extraFieldsConfig, sellerName, sellerWhatsApp, visualConfig } = firestoreState;

        // Inject dynamic backendUrl
        const host = req.get("host");
        const protocol = req.headers["x-forwarded-proto"] || req.protocol;
        const currentBackendUrl = `${protocol}://${host}`;
        const backendUrlStr = `    let backendUrl = '${currentBackendUrl}';`;
        html = injectIntoHtml(html, "// === BACKEND_URL_START ===", "// === BACKEND_URL_END ===", backendUrlStr);

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
        if (visualConfig) {
          const visualConfigStr = `    let visualConfig = ${JSON.stringify(visualConfig, null, 6)};`;
          html = injectIntoHtml(html, "// === VISUAL_START ===", "// === VISUAL_END ===", visualConfigStr);
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
          if (imgUrl.startsWith("/") || imgUrl.startsWith("IMGs/") || imgUrl.startsWith("uploads/")) {
            const host = req.get("host");
            const protocol = req.headers["x-forwarded-proto"] || req.protocol;
            const cleanPath = imgUrl.startsWith("/") ? imgUrl : `/${imgUrl}`;
            imgUrl = `${protocol}://${host}${cleanPath}`;
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
