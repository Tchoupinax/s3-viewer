{{- define "s3-viewer.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "s3-viewer.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "s3-viewer.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "s3-viewer.labels" -}}
helm.sh/chart: {{ include "s3-viewer.chart" . }}
app.kubernetes.io/name: {{ include "s3-viewer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "s3-viewer.operator.name" -}}
{{- printf "%s-operator" (include "s3-viewer.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "s3-viewer.operator.labels" -}}
{{ include "s3-viewer.labels" . }}
app.kubernetes.io/component: operator
{{- end }}

{{- define "s3-viewer.operator.selectorLabels" -}}
app.kubernetes.io/name: {{ include "s3-viewer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: operator
{{- end }}

{{- define "s3-viewer.operator.serviceAccountName" -}}
{{- if .Values.operator.serviceAccount.create }}
{{- default (include "s3-viewer.operator.name" .) .Values.operator.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.operator.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "s3-viewer.operator.image" -}}
{{- printf "%s:%s" .Values.operator.image.repository (.Values.operator.image.tag | default .Chart.AppVersion) }}
{{- end }}
