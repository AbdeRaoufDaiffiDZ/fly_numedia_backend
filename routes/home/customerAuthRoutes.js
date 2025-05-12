const router = require('express').Router()
const customerAuthController = require('../../controllers/home/customerAuthController')
router.post('/customer/customer-register', customerAuthController.customer_register)  //done
router.post('/customer/customer-login', customerAuthController.customer_login) //done
router.get('/customer/logout', customerAuthController.customer_logout) //done
router.post('/customer/customer-send-reset-code', customerAuthController.customer_send_reset_code) //done
router.post('/customer/customer-verify-code', customerAuthController.customer_verify_code) //done
router.post('/customer/customer-reset-password', customerAuthController.customer_reset_password) //done

module.exports = router