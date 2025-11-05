"""Debug test for OAuth2 Proxy."""

import time
from playwright.sync_api import Page


def test_oauth2_proxy_debug(page: Page):
    """Debug test to see what OAuth2 Proxy shows."""
    print("\n=== OAuth2 Proxy Debug Test ===")
    
    # Open OAuth2 Proxy
    print("1. Opening OAuth2 Proxy at http://localhost:4180")
    page.goto("http://localhost:4180")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    print(f"Current URL: {page.url}")
    
    # Take screenshot
    page.screenshot(path="/tmp/oauth2_debug_initial.png")
    print("Screenshot saved: /tmp/oauth2_debug_initial.png")
    
    # Print page content
    print("\n=== Page Text ===")
    body_text = page.locator('body').inner_text()
    print(body_text[:500])
    
    # Print HTML
    print("\n=== Page HTML ===")
    html = page.content()
    print(html[:1000])
    
    # Check for all links
    print("\n=== All Links ===")
    links = page.locator('a')
    link_count = links.count()
    print(f"Number of links: {link_count}")
    for i in range(link_count):
        link_text = links.nth(i).inner_text()
        link_href = links.nth(i).get_attribute('href')
        print(f"Link {i}: text='{link_text}', href='{link_href}'")
    
    # Check if we need to click "Sign in with Keycloak" button
    sign_in_button = page.locator('button:has-text("Sign in with Keycloak")')
    if sign_in_button.is_visible():
        print("\n✓ Found 'Sign in with Keycloak' button, clicking...")
        # Нажимаем кнопку и ждем редиректа на Keycloak
        sign_in_button.click(no_wait_after=True)
        # Ждем, пока URL изменится (редирект на Keycloak)
        page.wait_for_url(lambda url: "8080" in url or url != "http://localhost:4180/", timeout=15000)
        time.sleep(2)
        print(f"Current URL after clicking: {page.url}")
    
    # Check if we're on Keycloak
    if "8080" in page.url:
        print("\n✓ Redirected to Keycloak")
        print("Logging in...")
        
        username_field = page.locator('input#username, input[name="username"]').first
        password_field = page.locator('input#password, input[name="password"]').first
        
        username_field.fill("user1")
        password_field.fill("password123")
        
        submit_button = page.locator('input[type="submit"], button[type="submit"]').first
        submit_button.click()
        
        print("\nWaiting for redirect...")
        time.sleep(8)
        
        print(f"Current URL after login: {page.url}")
        
        # Take screenshot
        page.screenshot(path="/tmp/oauth2_debug_after_login.png")
        print("Screenshot saved: /tmp/oauth2_debug_after_login.png")
        
        # Print page content
        print("\n=== Page Text After Login ===")
        body_text = page.locator('body').inner_text()
        print(body_text[:1000])
        
        # Check for h1 elements
        print("\n=== H1 Elements ===")
        h1_count = page.locator('h1').count()
        print(f"Number of h1 elements: {h1_count}")
        if h1_count > 0:
            for i in range(h1_count):
                h1_text = page.locator('h1').nth(i).inner_text()
                print(f"h1[{i}]: {h1_text}")
