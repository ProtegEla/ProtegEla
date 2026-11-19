from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Exceção base para erros conhecidos da aplicação."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_SERVER_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[List[Dict[str, Any]]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []


class EntityNotFoundException(AppException):
    def __init__(self, message: str = "Recurso não encontrado", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class BusinessRuleException(AppException):
    def __init__(self, message: str, code: str = "BUSINESS_RULE_VIOLATION", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(
            message=message,
            code=code,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Credenciais inválidas ou token expirado"):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenException(AppException):
    def __init__(self, message: str = "Você não tem permissão para realizar esta ação"):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class ExternalServiceException(AppException):
    def __init__(self, message: str = "Serviço externo temporariamente indisponível"):
        super().__init__(
            message=message,
            code="EXTERNAL_SERVICE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


def _format_error_response(code: str, message: str, status_code: int, details: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "status_code": status_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": details,
        }
    }


def setup_exception_handlers(app: FastAPI) -> None:
    """Registra manipuladores globais de erro para assegurar o envelope RFC 7807."""

    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_format_error_response(
                code=exc.code,
                message=exc.message,
                status_code=exc.status_code,
                details=exc.details,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError):
        formatted_details = []
        for error in exc.errors():
            loc = ".".join(str(p) for p in error.get("loc", []))
            formatted_details.append(
                {
                    "field": loc,
                    "issue": error.get("msg", "Campo inválido"),
                    "type": error.get("type", "value_error"),
                }
            )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_format_error_response(
                code="VALIDATION_ERROR",
                message="Os dados fornecidos são inválidos.",
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                details=formatted_details,
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_format_error_response(
                code="INTERNAL_SERVER_ERROR",
                message="Ocorreu um erro interno inesperado no servidor.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                details=[],
            ),
        )
