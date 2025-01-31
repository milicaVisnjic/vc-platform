angular.module('platformWebApp')
    .config(['$stateProvider', '$httpProvider', function ($stateProvider, $httpProvider) {
        $stateProvider.state('loginDialog',
            {
                url: '/login',
                templateUrl: '$(Platform)/Scripts/app/security/login/login.tpl.html',
                controller: [
                    '$scope', 'platformWebApp.settings', 'platformWebApp.authService', 'platformWebApp.externalSignInService',
                    function ($scope, settings, authService, externalSignInService) {
                        externalSignInService.getProviders().then(
                            function (response) {
                                $scope.externalLoginProviders = response.data;
                            });
                        $scope.user = {};
                        $scope.authError = null;
                        $scope.authReason = false;
                        $scope.loginProgress = false;
                        $scope.ok = function () {
                            // Clear any previous security errors
                            $scope.authError = null;
                            $scope.loginProgress = true;
                            // Try to login
                            authService.login($scope.user.email, $scope.user.password, $scope.user.remember).then(
                                function (loggedIn) {
                                    $scope.loginProgress = false;
                                    if (!loggedIn) {
                                        $scope.authError = 'invalidCredentials';
                                    }
                                },
                                function (x) {
                                    $scope.loginProgress = false;
                                    if (angular.isDefined(x.status)) {
                                        if (x.status === 401) {
                                            $scope.authError = 'The login or password is incorrect.';
                                        } else {
                                            $scope.authError = 'Authentication error (code: ' + x.status + ').';
                                        }
                                    } else {
                                        $scope.authError = 'Authentication error ' + x;
                                    }
                                });
                        };
                    }
                ]
            });

        $stateProvider.state('forgotpasswordDialog',
            {
                url: '/forgotpassword',
                templateUrl: '$(Platform)/Scripts/app/security/dialogs/forgotPasswordDialog.tpl.html',
                controller: ['$rootScope', '$scope', 'platformWebApp.authService', '$state', '$interval', function ($rootScope, $scope, authService, $state, $interval) {
                    $scope.viewModel = {};
                    $rootScope.preventLoginDialog = false;
                    $scope.ok = function () {
                        $scope.isLoading = true;
                        $scope.errorMessage = null;
                        authService.requestpasswordreset($scope.viewModel).then(function (result) {
                            $scope.isLoading = false;
                            angular.extend($scope, result);

                            if ($scope.nextRequestAt) {
                                $scope.formattedCountdown = getCountdown($scope.nextRequestAt);
                            }
                            else {
                                $scope.succeeded = true;
                            }

                        }, function (response) {
                            $scope.isLoading = false;
                            $scope.errorMessage = response.data.message;
                            if (!$scope.errors) {
                                $scope.errors = [];
                            }
                            $scope.errors.push(response.data.message);
                        });
                    };
                    $scope.close = function () {
                        $state.go('loginDialog');
                    };

                    $interval(function () {
                        $scope.formattedCountdown = getCountdown($scope.nextRequestAt);
                        if (!$scope.formattedCountdown) {
                            $scope.nextRequestAt = undefined;
                        }
                        return;
                    }, 1000);

                    function getCountdown(date) {
                        if (!date) {
                            return undefined;
                        }

                        var time = Math.floor(new Date(date).getTime() - new Date().getTime());

                        if (time <= 0) {
                            return undefined;
                        }

                        var seconds = Math.floor((time / 1000) % 60);
                        var minutes = Math.floor(time / 60000);

                        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
                    }
                }
                ]
            });

        $stateProvider.state('resetpasswordDialog', {
            url: '/resetpassword/:userId/{code:.*}',
            templateUrl: '$(Platform)/Scripts/app/security/dialogs/resetPasswordDialog.tpl.html',
            controller: ['$rootScope', '$scope', '$stateParams', 'platformWebApp.authService', function ($rootScope, $scope, $stateParams, authService) {
                $scope.viewModel = $stateParams;
                $scope.isValidToken = true;
                $scope.isLoading = true;
                authService.validatepasswordresettoken($scope.viewModel).then(function (retVal) {
                    $scope.isValidToken = retVal;
                    $scope.isLoading = false;
                    $scope.viewModel = { userId: $scope.viewModel.userId, code: $scope.viewModel.code, newPassword: '', newPassword2: '' }
                }, function (response) {
                    $scope.isLoading = false;
                    $scope.errors = response.data.errors;
                });
                $scope.ok = function () {
                    $scope.succeeded = undefined;
                    $scope.errors = null;
                    $scope.isLoading = true;
                    authService.resetpassword($scope.viewModel).then(function (retVal) {
                        $scope.isLoading = false;
                        $rootScope.preventLoginDialog = false;
                        angular.extend($scope, retVal);
                    }, function (response) {
                        $scope.viewModel.newPassword = $scope.viewModel.newPassword2 = undefined;
                        $scope.errors = response.data.errors;
                        $scope.isLoading = false;
                    });
                };
            }]
        })

            .state('workspace.securityModule', {
                url: '/security',
                templateUrl: '$(Platform)/Scripts/common/templates/home.tpl.html',
                controller: ['$scope', 'platformWebApp.bladeNavigationService', function ($scope, bladeNavigationService) {
                    var blade = {
                        id: 'security',
                        title: 'platform.blades.security-main.title',
                        subtitle: 'platform.blades.security-main.subtitle',
                        controller: 'platformWebApp.securityMainController',
                        template: '$(Platform)/Scripts/app/security/blades/security-main.tpl.html',
                        isClosingDisabled: true
                    };
                    bladeNavigationService.showBlade(blade);
                }
                ]
            })

            .state('changePasswordDialog', {
                url: '/changepassword',
                templateUrl: '$(Platform)/Scripts/app/security/dialogs/changePasswordDialog.tpl.html',
                params: {
                    onClose: null
                },
                controller: 'platformWebApp.changePasswordDialog'
            });
    }])

    .controller('platformWebApp.changePasswordDialog', ['$rootScope', '$state', '$scope', '$stateParams', 'platformWebApp.accounts', 'platformWebApp.authService', 'platformWebApp.passwordValidationService', function ($rootScope, $state, $scope, $stateParams, accounts, authService, passwordValidationService) {
        if (!authService.isAuthenticated) {
            $state.go('loginDialog');
        }

        $scope.userName = authService.userName;
        $scope.canCancel = !authService.passwordExpired;

        $scope.validatePasswordAsync = (value) => {
            $scope.validatedPassword = value;
            delete $scope.errors;
            return passwordValidationService.validatePasswordAsync(value);
        };

        $scope.cancel = () => {
            $scope.$dismiss('cancel');
        };

        $scope.ok = () => {
            accounts.changeCurrentUserPassword($scope.postData, (result) => {
                if (result.succeeded) {
                    authService.passwordExpired = false;
                    authService.daysTillPasswordExpiry = -1;
                    $rootScope.$emit('userPasswordChanged', authService);

                    if (angular.isFunction($stateParams.onClose)) {
                        $stateParams.onClose();
                    } else if (angular.isFunction($scope.$close)) {
                        $scope.$close(true);
                    } else {
                        // redirect to home page (after initial platform setup)
                        $state.go('workspace');
                    }
                } else {
                    showErrors(result);
                }
            }, (response) => {
                showErrors(response.data);
            });
        };

        var showErrors = (result) => {
            $scope.postData = {};
            $scope.errors = result.errors;
            $scope.succeeded = false;
        };
    }])

    .run(['$transitions', 'platformWebApp.mainMenuService', 'platformWebApp.metaFormsService', 'platformWebApp.widgetService', '$state', 'platformWebApp.authService',
        function ($transitions, mainMenuService, metaFormsService, widgetService, $state, authService) {
            //Register module in main menu
            var menuItem = {
                path: 'configuration/security',
                icon: 'fas fa-key',
                title: 'platform.menu.security',
                priority: 5,
                action: function () { $state.go('workspace.securityModule'); },
                permission: 'platform:security:access'
            };
            mainMenuService.addMenuItem(menuItem);

            metaFormsService.registerMetaFields("accountDetails",
                [
                    {
                        name: "isAdministrator",
                        title: "platform.blades.account-detail.labels.is-administrator",
                        valueType: "Boolean",
                        priority: 0
                    },
                    {
                        name: "userName",
                        templateUrl: "accountUserName.html",
                        priority: 1,
                        isRequired: true
                    },
                    {
                        name: "email",
                        templateUrl: "accountEmail.html",
                        priority: 2
                    },
                    {
                        name: "status",
                        templateUrl: "statusSelector.html",
                        priority: 3
                    },
                    {
                        name: "accountType",
                        templateUrl: "accountTypeSelector.html",
                        priority: 4
                    },
                    {
                        name: "accountInfo",
                        templateUrl: "accountInfo.html",
                        priority: 5
                    }
                ]);

            //Register widgets
            widgetService.registerWidget({
                controller: 'platformWebApp.accountRolesWidgetController',
                template: '$(Platform)/Scripts/app/security/widgets/accountRolesWidget.tpl.html',
            }, 'accountDetail');
            widgetService.registerWidget({
                controller: 'platformWebApp.changeLog.operationsWidgetController',
                template: '$(Platform)/Scripts/app/changeLog/widgets/operations-widget.tpl.html'
            }, 'accountDetail');
            widgetService.registerWidget({
                controller: 'platformWebApp.accountApiWidgetController',
                template: '$(Platform)/Scripts/app/security/widgets/accountApiWidget.tpl.html',
            }, 'accountDetail');

            // Prevent transition to workspace if password expired
            $transitions.onBefore({ to: 'workspace.**' }, function (transition) {
                if (authService.isAuthenticated && authService.passwordExpired) {
                    return transition.router.stateService.target('changePasswordDialog');
                }
            });
        }]);
