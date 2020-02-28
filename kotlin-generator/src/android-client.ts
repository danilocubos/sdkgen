import { AstRoot } from "@sdkgen/parser";
import { generateClass, generateEnum, generateErrorClass, generateTypeName, generateJsonAddRepresentation, mangle } from "./helpers";

interface Options {}

export function generateAndroidClientSource(ast: AstRoot, options: Options) {
    let code = "";

    code += `
@file:Suppress("UnusedImport")

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Point
import android.os.Build
import android.provider.Settings
import android.util.Base64
import android.util.Log
import android.view.WindowManager
import com.google.gson.*
import com.google.gson.reflect.TypeToken
import io.sdkgen.runtime.SdkgenHttpClient
import java.io.IOException
import java.io.InvalidObjectException
import java.io.Serializable
import java.lang.reflect.Type
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import kotlin.concurrent.timerTask
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.experimental.and
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

inline fun <reified T> Gson.fromJson(json: String) = fromJson<T>(json, object: TypeToken<T>() {}.type)
inline fun <reified T> Gson.fromJson(json: JsonElement) = fromJson<T>(json, object: TypeToken<T>() {}.type)

@ExperimentalCoroutinesApi
@Suppress("DeferredIsResult", "unused")
@SuppressLint("SimpleDateFormat", "StaticFieldLeak")
object API { \n`;

    code += `
    private class ByteArrayDeserializer : JsonDeserializer<ByteArray> {
        @Throws(JsonParseException::class)
        override fun deserialize(element: JsonElement, arg1: Type?, arg2: JsonDeserializationContext?): ByteArray {
            try {
                return android.util.Base64.decode(element.asString, android.util.Base64.DEFAULT)
            } catch (e: Exception) {
                throw JsonIOException("Erro ao serializar um campo de bytes.")
            }
        }
    }

    private class ByteArrayOptDeserializer : JsonDeserializer<ByteArray?> {
        @Throws(JsonParseException::class)
        override fun deserialize(element: JsonElement, arg1: Type?, arg2: JsonDeserializationContext?): ByteArray? {
            return try {
                android.util.Base64.decode(element.asString, android.util.Base64.DEFAULT)
            } catch (e: Exception) {
                null
            }
        }
    }

    private class CalendarDeserializer : JsonDeserializer<Calendar> {
        @Throws(JsonParseException::class)
        override fun deserialize(element: JsonElement, arg1: Type?, arg2: JsonDeserializationContext?): Calendar {
            val date = element.asString
            val formatter = SimpleDateFormat("M/d/yy hh:mm a")
            formatter.timeZone = TimeZone.getTimeZone("UTC")
            try {
                return Calendar.getInstance().apply { time = formatter.parse(date)!! }
            } catch (e: Exception) {
                throw JsonIOException("Erro ao serializar um campo de data.")
            }
        }
    }

    private class CalendarOptDeserializer : JsonDeserializer<Calendar?> {
        override fun deserialize(element: JsonElement, arg1: Type?, arg2: JsonDeserializationContext?): Calendar? {
            val date = element.asString
            val formatter = SimpleDateFormat("M/d/yy hh:mm a", Locale.getDefault())
            formatter.timeZone = TimeZone.getTimeZone("UTC")
            return try {
                Calendar.getInstance().apply { time = formatter.parse(date)!! }
            } catch (e: Exception) {
                null
            }
        }
    }

    private var client: SdkgenHttpClient? = null
    private val gson = GsonBuilder()
        .registerTypeAdapter(object: TypeToken<Calendar?>() {}.type, CalendarOptDeserializer())
        .registerTypeAdapter(object: TypeToken<Calendar>() {}.type, CalendarDeserializer())
        .registerTypeAdapter(object: TypeToken<ByteArray>() {}.type, ByteArrayDeserializer())
        .registerTypeAdapter(object: TypeToken<ByteArray?>() {}.type, ByteArrayOptDeserializer())
        .create()
    var calls = CallsImpl()

    fun initialize(baseUrl: String, applicationContext: Context, defaultTimeoutMillis: Long? = null) {
        client = if (defaultTimeoutMillis == null)
            SdkgenHttpClient(baseUrl, applicationContext)
        else
            SdkgenHttpClient(baseUrl, applicationContext, defaultTimeoutMillis = defaultTimeoutMillis)
    }\n\n`;

    for (const type of ast.enumTypes) {
        code += `   ${generateEnum(type)}`;
        code += "\n";
    }

    code += `   open class Error(val message: String? = null)\n\n`;
    code += `   data class Response<T>(val error: Error?, val data: T?)\n\n`;

    for (const type of ast.structTypes) {
        code += `   ${generateClass(type)}\n`;
    }

    const errorTypeEnumEntries: string[] = [];
    for (const error of ast.errors) {
        code += `   ${generateErrorClass(error)}\n`;
        errorTypeEnumEntries.push(error);
    }

    if (errorTypeEnumEntries.length > 0) {
        code += `
    enum class ErrorType {
        ${errorTypeEnumEntries.join(",\n        ")},
        Error;

        fun type(): Class<out API.Error> {
            return when(this) {
                ${errorTypeEnumEntries.map(error => `${error} -> API.${error}::class.java`).join("\n              ")}
                else ->  API.Error::class.java
            }
        }
    }\n\n`;
    }

    code += `   interface Calls { \n`;
    code += ast.operations
        .map(op => {
            let args = op.args
                .map(arg => `${mangle(arg.name)}: ${generateTypeName(arg.type)}`)
                .concat([`timeoutMillis: Long? = null`, `callback: ((response: Response<${generateTypeName(op.returnType)}>) -> Unit)? = null`]);
            return `       fun ${mangle(op.prettyName)}(${args}): Deferred<Response<out ${generateTypeName(op.returnType)}>> \n`;
        })
        .join("");
    code += `   }\n\n`;

    code += `   class CallsImpl: Calls {\n`;
    code += `       private val sdkgenIOScope = CoroutineScope(IO)\n`;
    code += ast.operations
        .map(op => {
            let opImpl = "";
            let args = op.args
                .map(arg => `${mangle(arg.name)}: ${generateTypeName(arg.type)}`)
                .concat([`timeoutMillis: Long?`, `callback: ((response: Response<${generateTypeName(op.returnType)}>) -> Unit)?`]);
            opImpl += `       override fun ${mangle(op.prettyName)}(${args}): Deferred<Response<out ${generateTypeName(
                op.returnType,
            )}>> = sdkgenIOScope.async { \n`;
            opImpl += `             if (client == null) { \n`;
            opImpl += `                 val response: Response<${generateTypeName(
                op.returnType,
            )}> = Response(Fatal("Você precisa iniciar o SdkGen para fazer chamadas."), null)\n`;
            opImpl += `                 callback?.invoke(response)\n`;
            opImpl += `                 return@async response \n`;
            opImpl += `             }\n`;

            if (op.args.length > 0) {
                opImpl += `             val bodyArgs = JsonObject().apply { \n`;
                op.args.forEach(arg => {
                    opImpl += `                 ${generateJsonAddRepresentation(arg.type, arg.name)}\n`;
                });
                opImpl += `             }\n`;
            } else {
                opImpl += `         val bodyArgs: JsonObject? = null`;
            }

            opImpl += `\n`;
            opImpl += `             val r = client?.makeRequest(\"${op.prettyName}\", bodyArgs, timeoutMillis)\n`;
            opImpl += `             val data = if (r?.result?.get("result") != null) \n`;
            opImpl += `                 gson.fromJson<${generateTypeName(op.returnType)}>(r.result?.get("result")!!)\n`;
            opImpl += `             else null \n`;
            opImpl += `\n`;
            opImpl += `             val error = if (r?.error != null) { \n`;
            opImpl += `                 val errorType = try { ErrorType.valueOf(r.error?.get("type")?.asString ?: "") } catch (e: Exception) { ErrorType.Error } \n`;
            opImpl += `                 gson.fromJson(r.error, errorType.type()) \n`;
            opImpl += `             } else null \n`;
            opImpl += `\n`;
            opImpl += `             val response: Response<${generateTypeName(op.returnType)}> = Response(error, data) \n`;
            opImpl += `             callback?.invoke(response) \n`;
            opImpl += `             return@async response \n`;
            opImpl += `       } \n`;
            return opImpl;
        })
        .join("");

    code += `   }\n`;
    code += `}`;

    return code;
}