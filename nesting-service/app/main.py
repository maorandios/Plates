from fastapi import FastAPI

from app.api.routes.jobs import router as jobs_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="PLATE Nesting Service",
        version="0.1.0",
        description="Async server-side polygon nesting service.",
    )
    app.include_router(jobs_router, prefix="/nest", tags=["nesting-jobs"])
    return app


app = create_app()
