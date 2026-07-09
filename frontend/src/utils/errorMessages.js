const ERROR_MESSAGES = {
  400: { default: 'Please check your input and try again.' },
  401: 'Invalid email or password. Please try again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested item could not be found.',
  409: 'This record already exists.',
  500: 'Something went wrong on our end. Please try again later.',
  network: 'Unable to connect. Please check your internet connection.',
}

export function getErrorMessage(error) {
  if (!error?.response) return ERROR_MESSAGES.network

  const status = error.response.status
  const data = error.response.data

  if (data?.error) return data.error
  if (data?.detail) return data.detail
  if (data?.non_field_errors) return data.non_field_errors[0]

  if (data && typeof data === 'object') {
    const firstKey = Object.keys(data)[0]
    if (firstKey && Array.isArray(data[firstKey])) {
      return `${firstKey}: ${data[firstKey][0]}`
    }
  }

  const msg = ERROR_MESSAGES[status]
  if (typeof msg === 'object') return msg.default
  return msg || 'An unexpected error occurred.'
}
