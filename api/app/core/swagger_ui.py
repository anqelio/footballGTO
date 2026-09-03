from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.docs import get_swagger_ui_oauth2_redirect_html
from app.main import app_v2


@app_v2.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    return get_swagger_ui_html(
        openapi_url=app_v2.openapi_url,
        title="",
        swagger_js_url="/dist/swagger-ui-bundle.js",
        swagger_css_url="/dist/swagger-ui.css",
        oauth2_redirect_url=app_v2.swagger_ui_oauth2_redirect_url,
    )


@app_v2.get(app_v2.swagger_ui_oauth2_redirect_url, include_in_schema=False)
async def swagger_oauth2_redirect():
    return get_swagger_ui_oauth2_redirect_html()
