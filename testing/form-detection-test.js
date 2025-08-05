const puppeteer = require("puppeteer");

async function testFormDetection() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  
  try {
    console.log("🔍 Testing form detection on /leads-management...");
    
    await page.goto("http://localhost:5000/leads-management", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Check if we're being redirected to landing page
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Check page title to understand what page we're on
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check for auth-related elements
    const hasLoginForm = await page.$('input[type="email"], input[type="password"]') !== null;
    console.log(`🔐 Has login form: ${hasLoginForm}`);
    
    // Check if we see any authentication prompts
    const authText = await page.$eval('body', el => el.textContent).catch(() => "");
    const needsAuth = authText.includes("login") || authText.includes("authenticate") || authText.includes("sign in");
    console.log(`🔒 Needs authentication: ${needsAuth}`);

    // Wait for React to render
    await page.waitForTimeout(3000);

    // Check for modals or hidden forms
    console.log("🔍 Looking for modals and hidden forms...");
    
    // Look for buttons that might open forms
    const formTriggerButtons = await page.$$eval('button', (buttons) => {
      return buttons.filter(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes('add') || text.includes('create') || text.includes('new') || 
               text.includes('edit') || text.includes('form') || text.includes('configure');
      }).map((btn, i) => ({
        index: i,
        text: btn.textContent.trim(),
        className: btn.className,
        disabled: btn.disabled
      }));
    });

    console.log(`\n🎯 Found ${formTriggerButtons.length} potential form trigger buttons:`);
    formTriggerButtons.slice(0, 5).forEach(btn => {
      console.log(`  - "${btn.text}" (${btn.disabled ? 'disabled' : 'enabled'})`);
    });

    // Try clicking a form trigger button to see if forms appear
    if (formTriggerButtons.length > 0) {
      try {
        const firstButton = formTriggerButtons[0];
        console.log(`\n🖱️ Clicking "${firstButton.text}" to look for forms...`);
        
        await page.click(`button:nth-of-type(${firstButton.index + 1})`);
        await page.waitForTimeout(2000);
        
        // Check for forms again after clicking
        const formsAfterClick = await page.$$eval("form", (elements) => {
          return elements.map((form, index) => ({
            index,
            inputCount: form.querySelectorAll("input, textarea, select").length,
            visible: form.offsetParent !== null,
            className: form.className
          }));
        });
        
        console.log(`📊 Forms found after clicking: ${formsAfterClick.length}`);
        formsAfterClick.forEach(form => {
          console.log(`  - Form ${form.index}: ${form.inputCount} inputs, visible: ${form.visible}`);
        });
        
      } catch (error) {
        console.log(`❌ Could not click button: ${error.message}`);
      }
    }

    // Test forms detection with improved logic
    const forms = await page.$$eval("form", (elements) => {
      return elements.map((form, index) => {
        const hasSubmitHandler = !!(
          form.onsubmit || 
          form.getAttribute("onsubmit") ||
          form.getAttribute("novalidate") !== null ||
          form.querySelector('button[type="submit"]') ||
          form.querySelector('input[type="submit"]')
        );
        
        const inputCount = form.querySelectorAll("input, textarea, select").length;
        const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]').length;
        
        return {
          index,
          hasSubmitHandler,
          inputCount,
          submitButtons,
          action: form.action || "none",
          method: form.method || "GET",
          novalidate: form.hasAttribute("novalidate"),
          className: form.className,
          hasFormElements: inputCount > 0
        };
      });
    });

    console.log(`\n📊 Forms found: ${forms.length}`);
    
    forms.forEach((form, i) => {
      console.log(`\nForm ${i + 1}:`);
      console.log(`  - Inputs: ${form.inputCount}`);
      console.log(`  - Submit buttons: ${form.submitButtons}`);
      console.log(`  - Has handler: ${form.hasSubmitHandler}`);
      console.log(`  - NoValidate: ${form.novalidate}`);
      console.log(`  - Action: ${form.action}`);
      console.log(`  - Class: ${form.className}`);
    });

    // Also check for any elements that might be form-like
    const formLikeElements = await page.$$eval('[role="form"], .form, [data-testid*="form"], [class*="form"]', (elements) => {
      return elements.map((el, i) => ({
        index: i,
        tagName: el.tagName,
        className: el.className,
        role: el.getAttribute('role'),
        testId: el.getAttribute('data-testid'),
        text: el.textContent.substring(0, 100) + '...',
        hasInputs: el.querySelectorAll('input, textarea, select').length
      }));
    });

    console.log(`\n🔍 Form-like elements found: ${formLikeElements.length}`);
    
    formLikeElements.slice(0, 10).forEach((el, i) => {
      console.log(`\nForm-like element ${i + 1}:`);
      console.log(`  - Tag: ${el.tagName}`);
      console.log(`  - Class: ${el.className}`);
      console.log(`  - Role: ${el.role}`);
      console.log(`  - Inputs: ${el.hasInputs}`);
      console.log(`  - Text: ${el.text}`);
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await browser.close();
  }
}

testFormDetection().catch(console.error);
