const envType = process.env.NODE_ENV;
module.exports = {
  successResponse: (res, statusCode = 200, message = 'Success', data) => {
    if (statusCode == 201) {
      message = (message && message != "") ? message : 'Created';
      statusCode = 200;
    }
    if (message == '' || null) message = 'Success';
    if (!data) {
      return res.status(statusCode).json({
        status: true,
        message: message,
      });
    } else {
      return res.status(statusCode).json({
        status: true,
        message: message,
        data,
      });
    }
  },

  errorResponse: (res, statusCode = 500, message = 'Error Occured', error = null) => {
    if ((statusCode == 404)) {
      message = (message && message != "") ? message : 'Not Found';
    }
    if (statusCode == 403) {
      message = (message && message != "") ? message : 'Forbidden';
      statusCode = 500;
    }

    if (message == '' || message == null) message = 'Error Occured';
    if (!(envType == 'development' || 'testing')) error = null;
    if (!error) {
      return res.status(statusCode).json({
        status: false,
        message: message,
      });
    } else {
      return res.status(statusCode).json({
        status: false,
        message: message,
        error,
      });
    }
  },
};
