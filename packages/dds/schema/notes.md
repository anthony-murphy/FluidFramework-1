# Human Added
- [x] use const object rather than enums
- [x] tag all types intended to be export from the package as @legacy @alpha
- [x] ensure our package.json aligns with other packages, we have very specific requirements around api doc generation, and exports
- [x] put implementations in non-index.ts files. index ts should just be exports.
- [x] keep test code, like MockStorage, and product code separate. test code should live in the test folder
- [x] you copied usage error when you should have just imported it from telemetry utils. might be other similar problems.
- [ ] rather than SchematizedView could we have a common type for a root schema that does the same thing, but can be reused, rather than each type building their own.
- [ ] we need to add test to the map project that validate the viewWith works
- [ ] this package needs a legacy/alpha export, as we are adding legacy alpha types.
- [ ] review the schema project and add notes under AI Added heading

# AI Added
